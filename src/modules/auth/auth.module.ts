import { Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { durationToSeconds } from '../../common/utils/duration';
import type { AppConfig } from '../../config/configuration';
import { AuditModule } from '../audit/audit.module';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { AuthRepository } from './repositories/auth.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenService } from './token.service';

/**
 * Instantiated only when credentials exist, so the API boots without them and
 * the Google routes answer 501 instead of crashing at startup.
 */
const googleStrategyProvider: Provider = {
  provide: GoogleStrategy,
  inject: [ConfigService, AuthService],
  useFactory: (config: ConfigService<AppConfig, true>, auth: AuthService) => {
    const credentials = config.get('google', { infer: true });

    if (!credentials) {
      new Logger(AuthModule.name).warn(
        'Google sign-in disabled: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL are not set',
      );
      return null;
    }

    return new GoogleStrategy(auth, credentials);
  },
};

@Module({
  imports: [
    AuditModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { secret, accessTtl } = config.get('jwt', { infer: true });
        // Seconds rather than the raw string: jsonwebtoken types expiresIn as its
        // own template literal, which the validated env string does not satisfy.
        return { secret, signOptions: { expiresIn: durationToSeconds(accessTtl) } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    AuthCookieService,
    AuthRepository,
    RefreshTokenRepository,
    LocalStrategy,
    JwtStrategy,
    googleStrategyProvider,
  ],
  exports: [AuthService, AuthRepository, PasswordService, TokenService, AuthCookieService],
})
export class AuthModule {}
