import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP's second recommended argon2id configuration: 19 MiB, t=2, p=1. */
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService implements OnModuleInit {
  private decoyHash!: string;

  async onModuleInit(): Promise<void> {
    this.decoyHash = await this.hash(randomBytes(32).toString('hex'));
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed stored hash is a failed verification, not a 500.
      return false;
    }
  }

  /**
   * Burns the same work as a real verification when there is nothing to verify.
   *
   * Without it, an unknown email answers measurably faster than a known one with
   * a wrong password, which turns the login endpoint into an email oracle.
   */
  async verifyDecoy(plain: string): Promise<void> {
    await this.verify(this.decoyHash, plain);
  }
}
