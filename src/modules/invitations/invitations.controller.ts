import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
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
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PagePaginationDto } from '../../common/dto/pagination.dto';
import { Permission } from '../../common/permissions/permissions.config';
import { AuthCookieService } from '../auth/auth-cookie.service';
import { AuthService } from '../auth/auth.service';
import { AUTH_THROTTLE } from '../auth/auth.throttle';
import { SessionDto } from '../auth/dto/session.dto';
import { TokenService } from '../auth/token.service';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  InvitationPageDto,
  InvitationPreviewDto,
  InvitationTokenDto,
  IssuedInvitationDto,
} from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
    private readonly tokens: TokenService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @RequirePermissions(Permission.UserManage)
  @ApiOperation({ summary: 'List the invitations this organization has issued' })
  @ApiOkResponse({ type: InvitationPageDto })
  list(@Query() query: PagePaginationDto): Promise<InvitationPageDto> {
    return this.invitations.list(query);
  }

  @Post()
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Insufficient permissions, or a role that cannot be given' })
  @RequirePermissions(Permission.UserManage)
  @ApiOperation({ summary: 'Invite someone, and get the link to hand them' })
  @ApiCreatedResponse({ type: IssuedInvitationDto })
  @ApiConflictResponse({ description: 'Already a member, or already invited' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ): Promise<IssuedInvitationDto> {
    return this.invitations.create(actor, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @RequirePermissions(Permission.UserManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an invitation that has not been used' })
  @ApiNoContentResponse({ description: 'Revoked' })
  @ApiNotFoundResponse({ description: 'No such invitation in this organization' })
  @ApiConflictResponse({ description: 'Already used or already revoked' })
  revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.invitations.revoke(id);
  }

  /**
   * Both public routes take the token in the body rather than the path.
   *
   * A path lands in access logs, in the Referer header and in every proxy on the
   * way, which is the same reason the Google callback carries no token either.
   */
  @Post('lookup')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: AUTH_THROTTLE })
  @ApiOperation({ summary: 'Read what an invitation link stands for' })
  @ApiOkResponse({ type: InvitationPreviewDto })
  @ApiNotFoundResponse({ description: 'Unknown, spent, revoked or expired' })
  lookup(@Body() dto: InvitationTokenDto): Promise<InvitationPreviewDto> {
    return this.invitations.preview(dto.token);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: AUTH_THROTTLE })
  @ApiOperation({ summary: 'Take up an invitation and open a session' })
  @ApiCreatedResponse({ type: SessionDto })
  @ApiNotFoundResponse({ description: 'Unknown, spent, revoked or expired' })
  @ApiConflictResponse({ description: 'That email already belongs to a member' })
  async accept(
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    const user = await this.invitations.accept(dto);

    const issued = await this.auth.issueSession(user, {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    });

    this.cookies.setRefreshToken(response, issued.refreshToken, this.tokens.refreshMaxAgeMs);

    return issued.session;
  }
}
