import { BadRequestException, Injectable } from '@nestjs/common';
import { LocationsRepository } from './repositories/locations.repository';

/**
 * Answers "which warehouse" for every caller that does not care.
 *
 * Multi-warehouse is in the schema but not in the product yet, so an omitted
 * location resolves to the default here instead of in each use case.
 */
@Injectable()
export class LocationsService {
  constructor(private readonly locations: LocationsRepository) {}

  /**
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
}
