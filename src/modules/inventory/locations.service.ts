import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toPage } from '../../common/dto/paginate';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type {
  CreateLocationDto,
  ListLocationsDto,
  LocationDto,
  LocationPageDto,
  UpdateLocationDto,
} from './dto/location.dto';
import { LocationsRepository } from './repositories/locations.repository';

@Injectable()
export class LocationsService {
  constructor(
    private readonly locations: LocationsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListLocationsDto): Promise<LocationPageDto> {
    const rows = await this.locations.findPage(query.limit, query.cursor, query.search);
    return toPage(rows, query.limit);
  }

  /** @throws {NotFoundException} which is also the answer for another organization's location. */
  async findOne(id: string): Promise<LocationDto> {
    const location = await this.locations.findById(id);

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  /**
   * Answers "which warehouse" for every caller that does not name one.
   *
   * @throws {BadRequestException} when the id is not this organization's, or when
   * none was given and the organization has no default seeded.
   */
  async resolve(locationId?: string): Promise<string> {
    if (locationId) {
      if (!(await this.locations.exists(locationId))) {
        throw new BadRequestException('That location does not exist');
      }

      return locationId;
    }

    const defaultId = await this.locations.findDefaultId();

    if (!defaultId) {
      throw new BadRequestException('The organization has no default location');
    }

    return defaultId;
  }

  /** @throws {ConflictException} when the name is taken in this organization. */
  async create(dto: CreateLocationDto): Promise<LocationDto> {
    await this.assertNameIsFree(dto.name);

    const created = await this.locations.runInTransaction(async (tx) => {
      const location = await this.locations.create(
        { name: dto.name, isDefault: dto.isDefault ?? false },
        tx,
      );

      if (dto.isDefault) {
        await this.locations.demoteOthers(location.id, tx);
      }

      return location;
    });

    await this.audit.record({
      action: AuditAction.LocationCreated,
      entity: AuditEntity.Location,
      entityId: created.id,
      metadata: { name: created.name, isDefault: created.isDefault },
    });

    return created;
  }

  /**
   * @throws {BadRequestException} on `isDefault: false`. Demoting the only default
   * would leave every movement that names no location with nowhere to land, so a
   * default is replaced by promoting another, never by clearing this one.
   */
  async update(id: string, dto: UpdateLocationDto): Promise<LocationDto> {
    const current = await this.findOne(id);

    if (dto.isDefault === false) {
      throw new BadRequestException('Promote another location instead of clearing this one');
    }

    if (dto.name && dto.name !== current.name) {
      await this.assertNameIsFree(dto.name, id);
    }

    await this.locations.runInTransaction(async (tx) => {
      await this.locations.update(
        id,
        {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.isDefault ? { isDefault: true } : {}),
        },
        tx,
      );

      if (dto.isDefault) {
        await this.locations.demoteOthers(id, tx);
      }
    });

    await this.audit.record({
      action: AuditAction.LocationUpdated,
      entity: AuditEntity.Location,
      entityId: id,
      metadata: { nameFrom: dto.name ? current.name : undefined, nameTo: dto.name },
    });

    return this.findOne(id);
  }

  /**
   * @throws {ConflictException} when the ledger references it, or when it is the
   * default. A location is not deactivated like a product because nothing reads
   * it after the fact: the lines carry their own.
   */
  async remove(id: string): Promise<void> {
    const location = await this.findOne(id);

    if (location.isDefault) {
      throw new ConflictException('The default location cannot be deleted');
    }

    if (await this.locations.isReferenced(id)) {
      throw new ConflictException('Movements or stock still reference this location');
    }

    await this.locations.delete(id);

    await this.audit.record({
      action: AuditAction.LocationDeleted,
      entity: AuditEntity.Location,
      entityId: id,
      metadata: { name: location.name },
    });
  }

  private async assertNameIsFree(name: string, exceptId?: string): Promise<void> {
    if (await this.locations.existsWithName(name, exceptId)) {
      throw new ConflictException('Another location already uses that name');
    }
  }
}
