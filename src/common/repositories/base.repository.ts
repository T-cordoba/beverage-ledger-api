import { PrismaService } from '../../infra/prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Base de todo repositorio que toque datos de negocio.
 *
 * El aislamiento entre organizaciones no puede depender de que cada consulta
 * recuerde filtrar: basta un olvido para filtrar datos de otro cliente. Aquí el
 * filtro se compone siempre desde el contexto de la petición, y `scopedWhere`
 * lo aplica al final para que un `where` de entrada no pueda sobrescribirlo.
 *
 * Los repositorios concretos llegan en la Fase 3.
 */
export abstract class BaseRepository {
  protected constructor(
    protected readonly prisma: PrismaService,
    protected readonly tenant: TenantContextService,
  ) {}

  /** Organización de la petición en curso. */
  protected get organizationId(): string {
    return this.tenant.organizationId;
  }

  /**
   * Combina un filtro con el scope de la organización.
   *
   * El spread del scope va al final a propósito: si quien llama pasara un
   * organizationId, se ignora.
   */
  protected scopedWhere<T extends object>(where?: T): T & { organizationId: string } {
    return { ...(where ?? ({} as T)), organizationId: this.organizationId };
  }

  /** Datos de creación con la organización ya inyectada. */
  protected scopedData<T extends object>(data: T): T & { organizationId: string } {
    return { ...data, organizationId: this.organizationId };
  }
}
