import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Read directly rather than through `env()`, which throws on a missing variable:
// the shadow database is development-only and `migrate deploy` never creates
// one, so demanding it would break the deployment build.
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL || undefined;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations go through the direct/session connection: a transaction-mode
    // pooler cannot run them. The runtime client uses DATABASE_URL instead,
    // see src/infra/prisma/prisma.service.ts.
    url: env('DIRECT_URL'),

    // `migrate dev` creates and drops a shadow database to detect drift, which
    // Supabase's application role is not allowed to do, so it points at the
    // local docker-compose Postgres.
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
