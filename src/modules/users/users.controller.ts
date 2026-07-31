import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PagePaginationDto } from '../../common/dto/pagination.dto';
import { Permission } from '../../common/permissions/permissions.config';
import {
  ChangePasswordDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserDto,
  UserPageDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update your own profile' })
  @ApiOkResponse({ type: UserDto })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.users.updateProfile(user.id, dto);
  }

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change your own password. Signs out every session' })
  @ApiNoContentResponse({ description: 'Password changed' })
  @ApiBadRequestResponse({ description: 'The current password is missing' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.users.changePassword(user.id, dto);
  }

  @Get()
  @RequirePermissions(Permission.UserManage)
  @ApiOperation({ summary: 'List the organization members' })
  @ApiOkResponse({ type: UserPageDto })
  list(@Query() query: PagePaginationDto): Promise<UserPageDto> {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.UserManage)
  @ApiOperation({ summary: 'Read one member' })
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse({ description: 'No such user in this organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UserManage)
  @ApiOperation({ summary: 'Change a member name, role or status' })
  @ApiOkResponse({ type: UserDto })
  @ApiBadRequestResponse({
    description: 'The change would leave the organization without an admin',
  })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.users.update(actor.id, id, dto);
  }
}
