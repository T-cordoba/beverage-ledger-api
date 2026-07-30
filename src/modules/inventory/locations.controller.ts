import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import {
  CreateLocationDto,
  ListLocationsDto,
  LocationDto,
  LocationPageDto,
  UpdateLocationDto,
} from './dto/location.dto';
import { LocationsService } from './locations.service';

/** Reading is open to every authenticated user: capturing a movement needs it. */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List locations' })
  @ApiOkResponse({ type: LocationPageDto })
  list(@Query() query: ListLocationsDto): Promise<LocationPageDto> {
    return this.locations.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one location' })
  @ApiOkResponse({ type: LocationDto })
  @ApiNotFoundResponse({ description: 'No such location in this organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LocationDto> {
    return this.locations.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Create a location' })
  @ApiCreatedResponse({ type: LocationDto })
  @ApiConflictResponse({ description: 'The name is already in use' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@Body() dto: CreateLocationDto): Promise<LocationDto> {
    return this.locations.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Rename a location, or promote it to default' })
  @ApiOkResponse({ type: LocationDto })
  @ApiBadRequestResponse({ description: 'Demoting a default is not allowed' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationDto> {
    return this.locations.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CatalogManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a location the ledger does not reference' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'It is the default, or movements reference it' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.locations.remove(id);
  }
}
