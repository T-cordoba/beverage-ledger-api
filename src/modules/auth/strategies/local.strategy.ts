import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CredentialsService } from '../credentials.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly credentials: CredentialsService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  validate(email: string, password: string): Promise<AuthenticatedUser> {
    return this.credentials.validateCredentials(email, password);
  }
}
