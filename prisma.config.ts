import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Las migraciones van por la conexión directa / pooler en modo sesión.
    // El pooler en modo transacción (puerto 6543) no puede ejecutarlas.
    // En runtime el cliente usa DATABASE_URL a través del driver adapter,
    // ver src/infra/prisma/prisma.service.ts.
    url: env('DIRECT_URL'),

    // `migrate dev` necesita una base de sombra para detectar drift. En Supabase
    // el rol de la aplicación no puede crear bases, así que apuntamos al Postgres
    // local de docker-compose.
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
