import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toPage } from '../../common/dto/paginate';
import {
  MOVEMENT_PERMISSION,
  roleHasPermission,
} from '../../common/permissions/permissions.config';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MovementStatus, MovementType, MovementUnit } from '../../generated/prisma/enums';
import type { PrismaTransaction } from '../../infra/prisma/transaction';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { ProductsService } from '../catalog/products.service';
import type {
  CancelMovementDto,
  CreateMovementDto,
  ListMovementsDto,
  MovementDto,
  MovementPageDto,
  UpdateMovementDto,
} from './dto/movement.dto';
import { MovementLineInputDto } from './dto/movement.dto';
import { LocationsService } from './locations.service';
import { MovementsRepository, type MovementLineRow } from './repositories/movements.repository';
import { StockRepository } from './repositories/stock.repository';

/**
 * A large movement is one statement per distinct delta, not per line, so a
 * 215-line opening still fits well inside this.
 */
const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 15_000 };

const movementCode = (year: number, sequence: number): string =>
  `MOV-${year}-${String(sequence).padStart(6, '0')}`;

@Injectable()
export class MovementsService {
  constructor(
    private readonly movements: MovementsRepository,
    private readonly stock: StockRepository,
    private readonly locations: LocationsService,
    private readonly products: ProductsService,
    private readonly audit: AuditService,
    private readonly tenant: TenantContextService,
  ) {}

  async list(query: ListMovementsDto): Promise<MovementPageDto> {
    const rows = await this.movements.findPage(query.limit, query.cursor, {
      search: query.search,
      type: query.type,
      status: query.status,
      productId: query.productId,
      createdByUserId: query.createdByUserId,
      from: query.from,
      to: query.to,
    });

    return toPage(rows, query.limit);
  }

  /** @throws {NotFoundException} which is also the answer for another organization's movement. */
  async findOne(id: string): Promise<MovementDto> {
    const movement = await this.movements.findById(id);

    if (!movement) {
      throw new NotFoundException('Movement not found');
    }

    return movement;
  }

  /**
   * Opens a movement as a draft. Nothing reaches stock until it is confirmed.
   *
   * @throws {ForbiddenException} when the caller may not record this type.
   * @throws {BadRequestException} on an unknown product, a missing adjustment
   * reason, or a quantity whose sign contradicts the type.
   */
  async create(dto: CreateMovementDto): Promise<MovementDto> {
    this.assertMayRecord(dto.type);
    this.assertReason(dto.type, dto.reason);

    const occurredAt = this.resolveOccurredAt(dto.occurredAt);
    const locationId = await this.locations.resolve(dto.locationId);
    const items = await this.toLines(dto.type, dto.items);

    const id = await this.movements.runInTransaction(async (tx) => {
      const sequence = await this.movements.nextSequence(occurredAt.getFullYear(), tx);

      const movementId = await this.movements.create(
        {
          code: movementCode(occurredAt.getFullYear(), sequence),
          type: dto.type,
          locationId,
          occurredAt,
          reason: dto.reason ?? null,
          note: dto.note ?? null,
          createdByUserId: this.tenant.userId,
          items,
        },
        tx,
      );

      await this.audit.recordIn(tx, {
        action: AuditAction.MovementCreated,
        entity: AuditEntity.Movement,
        entityId: movementId,
        metadata: { type: dto.type, lines: items.length },
      });

      return movementId;
    });

    return this.findOne(id);
  }

  /** @throws {ConflictException} once it has been confirmed: edit the draft, not the record. */
  async update(id: string, dto: UpdateMovementDto): Promise<MovementDto> {
    const movement = await this.findOne(id);

    this.assertMayRecord(movement.type);
    this.assertDraft(movement.status);

    if (dto.reason !== undefined) {
      this.assertReason(movement.type, dto.reason);
    }

    const items = dto.items ? await this.toLines(movement.type, dto.items) : undefined;
    const occurredAt = dto.occurredAt ? this.resolveOccurredAt(dto.occurredAt) : undefined;

    await this.movements.runInTransaction(async (tx) => {
      await this.movements.updateDraft(
        id,
        {
          ...(occurredAt ? { occurredAt } : {}),
          ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
        items,
        tx,
      );

      await this.audit.recordIn(tx, {
        action: AuditAction.MovementUpdated,
        entity: AuditEntity.Movement,
        entityId: id,
        metadata: { code: movement.code, lines: items?.length },
      });
    }, TRANSACTION_OPTIONS);

    return this.findOne(id);
  }

  /**
   * Applies the movement to stock and closes it.
   *
   * The status change and every stock delta share one transaction, so the ledger
   * and its projection can never disagree.
   *
   * @throws {BadRequestException} when a line would leave stock below zero.
   * @throws {ConflictException} when it is no longer a draft.
   */
  async confirm(id: string): Promise<MovementDto> {
    const movement = await this.findOne(id);

    this.assertMayRecord(movement.type);
    this.assertDraft(movement.status);

    const deltas = this.groupByDelta(movement.items, 1);
    await this.assertStockSurvives(deltas, movement.locationId);

    await this.movements.runInTransaction(async (tx) => {
      const claimed = await this.movements.transition(
        id,
        MovementStatus.DRAFT,
        MovementStatus.CONFIRMED,
        { confirmedAt: new Date() },
        tx,
      );

      if (!claimed) {
        throw new ConflictException('The movement was already confirmed');
      }

      await this.applyDeltas(deltas, movement.locationId, tx);

      await this.audit.recordIn(tx, {
        action: AuditAction.MovementConfirmed,
        entity: AuditEntity.Movement,
        entityId: id,
        metadata: { code: movement.code, type: movement.type, lines: movement.items.length },
      });
    }, TRANSACTION_OPTIONS);

    return this.findOne(id);
  }

  /**
   * Voids a movement, giving back whatever it took.
   *
   * A confirmed movement is never deleted or edited: it is reversed, and both
   * sides stay on the ledger. Voiding an inbound whose goods have already gone
   * out is refused for the same reason a sale beyond stock is.
   *
   * @throws {ConflictException} when it is already cancelled.
   */
  async cancel(id: string, dto: CancelMovementDto): Promise<MovementDto> {
    const movement = await this.findOne(id);

    if (movement.status === MovementStatus.CANCELLED) {
      throw new ConflictException('The movement is already cancelled');
    }

    const wasConfirmed = movement.status === MovementStatus.CONFIRMED;
    const deltas = wasConfirmed
      ? this.groupByDelta(movement.items, -1)
      : new Map<number, string[]>();

    if (wasConfirmed) {
      await this.assertStockSurvives(deltas, movement.locationId);
    }

    await this.movements.runInTransaction(async (tx) => {
      const claimed = await this.movements.transition(
        id,
        movement.status,
        MovementStatus.CANCELLED,
        { cancelledAt: new Date() },
        tx,
      );

      if (!claimed) {
        throw new ConflictException('The movement changed while it was being cancelled');
      }

      if (wasConfirmed) {
        await this.applyDeltas(deltas, movement.locationId, tx);
      }

      await this.audit.recordIn(tx, {
        action: AuditAction.MovementCancelled,
        entity: AuditEntity.Movement,
        entityId: id,
        metadata: { code: movement.code, reason: dto.reason, stockReverted: wasConfirmed },
      });
    }, TRANSACTION_OPTIONS);

    return this.findOne(id);
  }

  /**
   * Normalizes each line to base units and freezes the names it will be read by.
   *
   * The snapshot is what keeps a year-old document faithful after the product is
   * renamed.
   */
  private async toLines(
    type: MovementType,
    lines: MovementLineInputDto[],
  ): Promise<MovementLineRow[]> {
    const targets = await this.products.resolveMovementTargets(lines.map((line) => line.productId));

    return lines.map((line) => {
      const target = targets.get(line.productId);

      if (!target) {
        throw new BadRequestException(`Unknown product: ${line.productId}`);
      }

      this.assertQuantitySign(type, line.quantity);

      const magnitude =
        line.unit === MovementUnit.CASE ? line.quantity * target.caseSize : line.quantity;

      return {
        productId: line.productId,
        quantity: line.quantity,
        unit: line.unit,
        // Only an outbound flips the sign. An adjustment carries its own, which
        // is what lets it correct in either direction.
        quantityBase: type === MovementType.OUTBOUND ? -magnitude : magnitude,
        productNameSnapshot: target.name,
        brandNameSnapshot: target.brandName,
      };
    });
  }

  /** Grouped by delta, so a 215-line movement is a handful of statements, not 215. */
  private groupByDelta(
    items: { productId: string; quantityBase: number }[],
    factor: 1 | -1,
  ): Map<number, string[]> {
    const totalByProduct = new Map<string, number>();

    for (const item of items) {
      totalByProduct.set(
        item.productId,
        (totalByProduct.get(item.productId) ?? 0) + item.quantityBase * factor,
      );
    }

    const productsByDelta = new Map<number, string[]>();

    for (const [productId, delta] of totalByProduct) {
      if (delta === 0) {
        continue;
      }

      const bucket = productsByDelta.get(delta);

      if (bucket) {
        bucket.push(productId);
      } else {
        productsByDelta.set(delta, [productId]);
      }
    }

    return productsByDelta;
  }

  /**
   * Names what would go negative before anything is written.
   *
   * The UPDATE carries the same check, which is what actually makes it safe under
   * concurrency; this pass exists so the caller is told which product is short
   * and by how much instead of getting a bare conflict.
   */
  private async assertStockSurvives(
    deltas: Map<number, string[]>,
    locationId: string,
  ): Promise<void> {
    const productIds = [...deltas.values()].flat();
    const levels = await this.stock.findLevels(productIds, locationId);
    const onHand = new Map(levels.map((level) => [level.productId, level.quantityBase]));

    const short: string[] = [];

    for (const [delta, ids] of deltas) {
      if (delta >= 0) {
        continue;
      }

      for (const productId of ids) {
        const available = onHand.get(productId) ?? 0;

        if (available + delta < 0) {
          short.push(`${productId} (on hand ${available}, needs ${-delta})`);
        }
      }
    }

    if (short.length > 0) {
      throw new BadRequestException(`Not enough stock for: ${short.join('; ')}`);
    }
  }

  private async applyDeltas(
    deltas: Map<number, string[]>,
    locationId: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    const productIds = [...deltas.values()].flat();
    await this.stock.ensureRows(productIds, locationId, tx);

    for (const [delta, ids] of deltas) {
      const moved = await this.stock.applyDelta(ids, locationId, delta, tx);

      if (moved !== ids.length) {
        // The guarded UPDATE refused a row the pre-check had cleared, which means
        // stock moved underneath us. Rolling back is the only correct answer.
        throw new ConflictException('Stock changed while the movement was being applied');
      }
    }
  }

  /** @throws {ForbiddenException} authorizing on the permission, never on the role. */
  private assertMayRecord(type: MovementType): void {
    if (!roleHasPermission(this.tenant.role, MOVEMENT_PERMISSION[type])) {
      throw new ForbiddenException(`You may not record ${type} movements`);
    }
  }

  /**
   * @throws {BadRequestException} on an adjustment with no reason.
   *
   * Adjustments are where a discrepancy gets buried, so the schema keeps `reason`
   * nullable for the other two types and the rule lives here.
   */
  private assertReason(type: MovementType, reason?: string): void {
    if (type === MovementType.ADJUSTMENT && !reason?.trim()) {
      throw new BadRequestException('An adjustment needs a reason');
    }
  }

  /**
   * @throws {BadRequestException} on a negative inbound or outbound.
   *
   * Without this a negative outbound is an inbound recorded by someone who was
   * never granted one, which is exactly the separation the roles exist to keep.
   */
  private assertQuantitySign(type: MovementType, quantity: number): void {
    if (type === MovementType.ADJUSTMENT) {
      if (quantity === 0) {
        throw new BadRequestException('An adjustment line cannot be zero');
      }
      return;
    }

    if (quantity <= 0) {
      throw new BadRequestException(
        `A ${type} line must be positive; the movement type carries the direction`,
      );
    }
  }

  private assertDraft(status: MovementStatus): void {
    if (status !== MovementStatus.DRAFT) {
      throw new ConflictException(`A ${status} movement can no longer be edited`);
    }
  }

  /** @throws {BadRequestException} on a future date: it has not happened yet. */
  private resolveOccurredAt(occurredAt?: Date): Date {
    const resolved = occurredAt ?? new Date();

    if (resolved.getTime() > Date.now()) {
      throw new BadRequestException('A movement cannot be dated in the future');
    }

    return resolved;
  }
}
