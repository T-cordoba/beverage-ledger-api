import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ProfileService } from './profile.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, ProfileService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
