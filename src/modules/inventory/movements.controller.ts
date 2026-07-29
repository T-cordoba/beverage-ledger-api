import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import {
  CancelMovementDto,
  CreateMovementDto,
  ListMovementsDto,
  MovementDto,
  MovementPageDto,
  UpdateMovementDto,
} from './dto/movement.dto';
import { MovementsService } from './movements.service';

/**
 * Creating and confirming carry no permission decorator on purpose: which one
 * applies depends on the movement's type, so MovementsService checks it against
 * the same declarative matrix. Everything else is static.
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  @Get()
  @RequirePermissions(Permission.MovementReadAll)
  @ApiOperation({ summary: 'List movements, filtered and paginated server-side' })
  @ApiOkResponse({ type: MovementPageDto })
  list(@Query() query: ListMovementsDto): Promise<MovementPageDto> {
    return this.movements.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.MovementReadAll)
  @ApiOperation({ summary: 'Read one movement with its lines' })
  @ApiOkResponse({ type: MovementDto })
  @ApiNotFoundResponse({ description: 'No such movement in this organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MovementDto> {
    return this.movements.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Open a movement as a draft. Stock is untouched until confirmed' })
  @ApiCreatedResponse({ type: MovementDto })
  @ApiBadRequestResponse({ description: 'Unknown product, missing reason or wrong quantity sign' })
  @ApiForbiddenResponse({ description: 'You may not record this type of movement' })
  create(@Body() dto: CreateMovementDto): Promise<MovementDto> {
    return this.movements.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft. Lines are replaced wholesale' })
  @ApiOkResponse({ type: MovementDto })
  @ApiConflictResponse({ description: 'It is no longer a draft' })
  @ApiForbiddenResponse({ description: 'You may not record this type of movement' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMovementDto,
  ): Promise<MovementDto> {
    return this.movements.update(id, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Apply the movement to stock and close it' })
  @ApiOkResponse({ type: MovementDto })
  @ApiBadRequestResponse({ description: 'A line would leave stock below zero' })
  @ApiConflictResponse({ description: 'It is no longer a draft' })
  @ApiForbiddenResponse({ description: 'You may not record this type of movement' })
  confirm(@Param('id', ParseUUIDPipe) id: string): Promise<MovementDto> {
    return this.movements.confirm(id);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.MovementCancel)
  @ApiOperation({ summary: 'Void a movement, returning whatever stock it took' })
  @ApiOkResponse({ type: MovementDto })
  @ApiBadRequestResponse({ description: 'Reverting it would leave stock below zero' })
  @ApiConflictResponse({ description: 'It is already cancelled' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelMovementDto,
  ): Promise<MovementDto> {
    return this.movements.cancel(id, dto);
  }
}
