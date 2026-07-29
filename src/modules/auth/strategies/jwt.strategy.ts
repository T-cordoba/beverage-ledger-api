import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import type { AppConfig } from '../../../config/configuration';
import { AuthService } from '../auth.service';
import type { JwtPayload } from '../jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly auth: AuthService,
    config: ConfigService<AppConfig, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
    });
  }

  /**
   * Re-reads the user instead of trusting the claims.
   *
   * A token is valid for its whole lifetime, so trusting the role inside it means
   * a demotion or a suspension only takes effect once it expires. One indexed
   * lookup per request is the cheaper side of that trade in a system whose whole
   * point is who may touch which numbers.
   */
  validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return this.auth.resolveTokenSubject(payload.sub);
  }
}
