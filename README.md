# Beverage Ledger API

API de gestión de inventario de licores para hostelería. Registra movimientos de producto —entradas de proveedor, salidas de bodega a barra, ajustes por merma— y mantiene existencias, historial auditable y reportes.

Construida con **NestJS 11**, **Prisma 7** y **PostgreSQL** (Supabase).

> Este repositorio es solo el backend. El frontend está en [`beverage-ledger`](https://github.com/T-cordoba/encore-beverage-ledger).

---

## Cómo funciona el inventario

La fuente de verdad es un **ledger inmutable**: cada movimiento confirmado deja líneas en `movement_items` que nunca se editan. Las existencias (`stock_levels`) son una proyección que se actualiza en la misma transacción que confirma o anula un movimiento.

Esto da dos cosas a la vez: el stock se lee en una sola consulta, y siempre es reconstruible desde el historial. Si la proyección y el ledger discrepan, hay un bug — y se puede detectar con una consulta.

Tres tipos de movimiento:

| Tipo | Efecto | Quién puede |
|---|---|---|
| `INBOUND` | Suma existencias | Manager, administrador |
| `OUTBOUND` | Resta existencias | Cualquiera, incluido el operador |
| `ADJUSTMENT` | Corrige en cualquier dirección, con motivo obligatorio | Manager, administrador |

El reparto sigue el principio de **segregación de funciones**: quien despacha mercancía no debería poder alterar los números que la justifican.

---

## Puesta en marcha

Requisitos: Node.js 20.19+, Docker (opcional, para la base local).

```bash
git clone https://github.com/T-cordoba/beverage-ledger-api.git
cd beverage-ledger-api
npm install

cp .env.example .env     # y rellenar los valores

docker compose up -d     # Postgres local (puertos 5434 y 5433)
npm run db:migrate       # aplica las migraciones
npm run db:seed:demo     # catálogo + datos de demostración

npm run start:dev
```

La API queda en `http://localhost:3001/api/v1` y Swagger en `http://localhost:3001/docs`.

### Las dos conexiones a la base de datos

No son intercambiables:

| Variable | Puerto en Supabase | Para qué |
|---|---|---|
| `DATABASE_URL` | 6543, pooler en modo transacción | La aplicación en runtime |
| `DIRECT_URL` | 5432, directa o pooler en modo sesión | Migraciones de Prisma |

El pooler en modo transacción no puede ejecutar migraciones. Y si la contraseña contiene `/ % @ :`, hay que URL-encodearla (`/` → `%2F`, `%` → `%25`) o la conexión falla con un error de parseo poco claro.

`SHADOW_DATABASE_URL` apunta al Postgres de `docker-compose`: `prisma migrate dev` necesita crear y destruir una base para detectar drift, y el rol de aplicación de Supabase no puede hacerlo. Solo se usa en desarrollo.

### Seed

```bash
npm run db:seed        # 215 licores, 14 categorías, 160 marcas, stock en CERO
npm run db:seed:demo   # lo anterior + apertura de inventario e histórico de salidas
```

La distinción es deliberada: un negocio recién dado de alta arranca con el inventario vacío y solo tiene existencias cuando alguien registra entradas. El stock simulado existe únicamente para que la demo se vea viva, y se genera con un PRNG con semilla fija para que sea idéntico en cualquier máquina.

Ambos modos son idempotentes.

---

## Estructura

```
prisma/
  schema.prisma        esquema, única fuente de verdad
  migrations/          versionadas
  seed.ts              siembra
  data/products.ts     catálogo semilla
src/
  config/              validación del entorno (Zod) y configuración tipada
  common/              filtros, DTOs compartidos, contexto de tenant, repositorio base
  infra/prisma/        PrismaService
  modules/             un módulo por dominio
```

Cada módulo respeta la misma cadena: **controller** (solo HTTP) → **service** (caso de uso, sin saber de HTTP ni de Prisma) → **repository** (lo único que toca Prisma) → **DTO** (valida con `class-validator` y documenta con `@nestjs/swagger`).

### Preparado para multi-tenant

Hoy hay una sola organización, pero el aislamiento está construido desde la primera migración: `organizationId` en toda tabla de negocio, un `TenantContextService` que guarda la organización de la petición en curso, y un `BaseRepository` que compone el filtro automáticamente. Ningún service escribe ese filtro a mano — basta un olvido para filtrar datos de otro cliente.

Lo que llega cuando el SaaS sea concreto: alta de organizaciones, facturación, invitaciones y subdominios.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Desarrollo con recarga |
| `npm run build` / `start:prod` | Compila y sirve |
| `npm run lint` / `typecheck` / `format` | Calidad de código |
| `npm run db:migrate` | Crea y aplica una migración |
| `npm run db:generate` | Regenera el cliente de Prisma |
| `npm run db:studio` | Inspector de datos |
| `npm run db:reset` | Borra y rehace la base (destructivo) |

El cliente de Prisma se genera en `src/generated/prisma` y **no se versiona**: tras clonar hay que correr `npm run db:generate`.

---

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Fundaciones: configuración, esquema, seed, `common/`, salud | ✅ |
| 2 | Autenticación: local + Google OAuth, JWT, refresh rotativo, permisos | 🔄 |
| 3 | Catálogo, inventario, reportes, generación de PDF | ⬜ |

---

## Licencia

© 2026 Tomás Córdoba Urquijo. Todos los derechos reservados.

Software propietario. No se concede permiso para copiar, modificar, distribuir ni usar este software sin autorización escrita del autor.
