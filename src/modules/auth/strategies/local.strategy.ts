import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  validate(email: string, password: string): Promise<AuthenticatedUser> {
    return this.auth.validateCredentials(email, password);
  }
}
