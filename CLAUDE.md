# CLAUDE.md — Beverage Ledger API

Contexto para agentes que trabajen en este repositorio.

---

## 1. Qué es esto

API de **Beverage Ledger**, un sistema de gestión de inventario de licores para hostelería. Registra movimientos de producto —entradas de proveedor, salidas de bodega a barra, ajustes por merma— y mantiene existencias, historial auditable y reportes.

La fuente de verdad del inventario es un **ledger inmutable** de líneas de movimiento; las existencias son una proyección derivada, nunca un número que se edita a mano.

**Este repositorio es solo el backend.** El frontend vive aparte.

| | Repositorio | Stack |
|---|---|---|
| Backend | `beverage-ledger-api` (este) → `C:\VisualProjects\beverage-ledger-api` | NestJS 11, Prisma 7, Supabase Postgres |
| Frontend | [`beverage-ledger`](https://github.com/T-cordoba/beverage-ledger) → `C:\VisualProjects\beverage-ledger` | Next.js 15, TypeScript, Tailwind |

Nació de una reescritura: el proyecto original era una sola app de Next.js con dos archivos de SQL sin validación, sin autenticación y sin esquema versionado. Ver §9.

---

## 2. Estado: construcción por fases

| Fase | Qué incluye | Estado |
|---|---|---|
| 1 | Scaffold, configuración, esquema Prisma, seed, `common/`, salud | ✅ Hecha |
| 2 | Auth: Passport local + Google OAuth, JWT, refresh rotativo, permisos | ✅ Hecha |
| 3 | Catálogo, inventario con stock, reportes, generación de PDF | 🔄 **Siguiente** |

Plan completo en el repo del front: `C:\Users\Tomas\.claude\plans\ok-voy-a-hacerle-tender-sprout.md`

### Dónde quedó la Fase 1

Todo verificado, no solo compilado. Migraciones aplicadas y seed ejecutado **contra Supabase**: 215 productos, 14 categorías, 160 marcas, 41 movimientos, 400 líneas, 12.745 unidades de stock. La invariante del ledger se comprueba con esta consulta, que debe devolver `descuadres = 0` y `total_ledger = total_proyeccion`:

```sql
WITH ledger AS (
  SELECT mi.product_id,
         SUM(CASE WHEN m.type = 'OUTBOUND' THEN -mi.quantity_base ELSE mi.quantity_base END) AS from_ledger
  FROM movement_items mi
  JOIN movements m ON m.id = mi.movement_id
  WHERE m.status = 'CONFIRMED'
  GROUP BY mi.product_id
)
SELECT
  (SELECT COUNT(*) FROM ledger l JOIN stock_levels s ON s.product_id = l.product_id
     WHERE s.quantity_base <> l.from_ledger) AS descuadres,
  (SELECT SUM(from_ledger) FROM ledger) AS total_ledger,
  (SELECT SUM(quantity_base) FROM stock_levels) AS total_proyeccion;
```

Existe `/api/v1/health` y nada más. No hay ningún módulo de negocio todavía.

### Dónde quedó la Fase 2

Todo verificado contra Supabase, no solo compilado. Endpoints disponibles:

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/auth/register` | público |
| `POST` | `/auth/login` | público |
| `POST` | `/auth/refresh` | cookie de refresh |
| `POST` | `/auth/logout` | autenticado |
| `GET` | `/auth/me` | autenticado |
| `GET` | `/auth/google` · `/auth/google/callback` | público |
| `PATCH` | `/users/me` · `PUT /users/me/password` | autenticado |
| `GET` `POST` | `/users` | `user:manage` |
| `GET` `PATCH` | `/users/:id` | `user:manage` |

Decisiones que quedaron tomadas al construirlo:

- **El registro público entra a la organización por defecto como `OPERATOR`** (`DEFAULT_ORGANIZATION_SLUG`). El alta de organizaciones sigue aplazada; un `ORG_ADMIN` promueve desde el panel.
- **La autenticación es global**: `JwtAuthGuard` está en `APP_GUARD`, así que una ruta nueva nace protegida y hay que marcarla `@Public()` para abrirla. Olvidar el decorador cierra, no expone.
- **`PermissionsGuard`, no `RolesGuard`** — lee `Permission`, nunca un rol, alimentado por `common/permissions/permissions.config.ts`. Es un no-op en rutas sin `@RequirePermissions()`.
- **La estrategia de Google se registra solo si hay credenciales.** Sin ellas la API arranca igual y las rutas de Google responden 501. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_CALLBACK_URL` se validan como conjunto: las tres o ninguna.
- **El callback de Google no devuelve el access token en la URL.** Deja la cookie de refresh y redirige a `FRONTEND_URL/auth/callback`; el front cambia la cookie por un token con `POST /auth/refresh`. Un token en la URL acaba en el historial, en los logs y en el `Referer`.
- **El JWT no se cree a sí mismo**: `JwtStrategy` relee el usuario en cada petición, de modo que una degradación de rol o una suspensión surten efecto de inmediato y no cuando expire el token.
- **`SEED_ADMIN_PASSWORD`** (opcional, la lee el seed y no la API) le da contraseña al admin sembrado. Sin ella queda `INVITED` y no puede entrar, que es el default correcto.

**Pendiente y consciente**: crear las credenciales OAuth en Google Cloud Console. Consent screen tipo *External* en modo *Testing*, scopes solo `email` y `profile`, cliente *Web application*, y redirect URI `http://localhost:3001/api/v1/auth/google/callback` — carácter por carácter igual a `GOOGLE_CALLBACK_URL`, porque es el error número uno de este flujo. El resto de la Fase 2 no depende de eso.

### Punto de partida de la Fase 3

`TenantContextService` ya se puebla y `BaseRepository` ya scopea de verdad — `UsersRepository` es el ejemplo a copiar. Queda el dominio: catálogo, movimientos con `stock_levels` en la misma transacción, reportes por agregación SQL y generación de PDF.

---

## 3. Comandos

```bash
npm run start:dev     # desarrollo con watch, en :3001
npm run build         # compila a dist/
npm run start:prod    # sirve el build

npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format        # Prettier

npm run db:migrate    # prisma migrate dev
npm run db:generate   # regenera el cliente en src/generated/prisma
npm run db:seed       # catálogo completo, stock en CERO
npm run db:seed:demo  # además, stock simulado e histórico de salidas
npm run db:studio     # inspector de datos
npm run db:reset      # borra y rehace todo (destructivo)
```

Postgres local para desarrollo: `docker compose up -d`. Levanta dos bases — la de trabajo en el puerto **5434** (no 5432, para no chocar con un Postgres instalado en la máquina) y la de sombra en el **5433**.

---

## 4. Configuración y bases de datos

Hay **dos conexiones al mismo Postgres** y no son intercambiables:

| Variable | Puerto Supabase | Quién la usa |
|---|---|---|
| `DATABASE_URL` | 6543, pooler en modo transacción | La aplicación en runtime, vía el driver adapter |
| `DIRECT_URL` | 5432, conexión directa o pooler en modo sesión | La CLI de Prisma, para migrar |

El pooler en modo transacción **no puede ejecutar migraciones**. El reparto está hecho en `prisma.config.ts` (migraciones → `DIRECT_URL`) y en `src/infra/prisma/prisma.service.ts` (runtime → `DATABASE_URL`).

`SHADOW_DATABASE_URL` apunta al Postgres de docker-compose: `migrate dev` necesita crear y destruir una base para detectar drift, y el rol de aplicación de Supabase no puede. Solo hace falta en desarrollo — `migrate deploy` no usa base de sombra.

Si una contraseña contiene `/ % @ :` hay que **URL-encodearla** o la conexión falla con un error de parseo poco descriptivo.

`JWT_SECRET` es obligatoria y de 32 caracteres mínimo; genérala con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Las de Google son opcionales pero se validan **como conjunto**: las tres o ninguna, para que una configuración a medias falle al arrancar y no en mitad del callback.

**Ningún módulo lee `process.env` directamente.** Todo pasa por `src/config/configuration.ts`, que valida el entorno con Zod al arrancar y llega tipado vía `ConfigService<AppConfig, true>`. Si falta o está mal una variable, el proceso no arranca — a diferencia del proyecto original, que fallaba en la primera consulta con un error indescifrable.

---

## 5. Arquitectura

```
prisma/
  schema.prisma        única fuente de verdad del esquema
  migrations/          versionadas en git
  seed.ts              siembra; modo mínimo y modo demo
  data/products.ts     catálogo semilla (215 licores). Es dato, no código.
src/
  main.ts              helmet, CORS, ValidationPipe, filtro global, Swagger
  app.module.ts
  config/              validación del entorno + configuración tipada
  common/
    auth/              AuthenticatedUser: lo que el guard adjunta a la petición
    decorators/        @Public, @CurrentUser, @RequirePermissions, IsStrongPassword
    dto/               paginación por cursor y tipos compartidos
    filters/           respuesta de error uniforme
    guards/            JwtAuthGuard y PermissionsGuard, ambos globales
    permissions/       la matriz de §6, en una sola definición
    repositories/      BaseRepository con scoping automático
    tenant/            TenantContextService (AsyncLocalStorage) + middleware
    utils/
  infra/prisma/        PrismaService y PrismaModule
  modules/             un módulo por dominio
    auth/  users/  health/
  generated/prisma/    cliente de Prisma. GENERADO: no editar, no commitear.
```

### La cadena de un módulo

**controller → service → repository → DTO**, siempre en ese orden y sin saltarse eslabones:

- **Controller**: solo HTTP. Ruta, códigos de estado, decoradores de Swagger. Sin lógica.
- **Service**: el caso de uso. No sabe qué es una petición HTTP ni qué es Prisma.
- **Repository**: lo único que toca Prisma. Extiende `BaseRepository`.
- **DTO**: `class-validator` para validar y `@nestjs/swagger` para documentar. Misma clase, ambas cosas.

Esta separación es también lo que hará testeable el código cuando llegue el trabajo de verificación y validación.

### Multi-tenancy

El producto apunta a SaaS a futuro. Hoy solo hay una organización, pero el aislamiento está construido desde la primera migración porque añadirlo después significaría migrar todas las tablas y reescribir todas las consultas:

- `organizationId` NOT NULL en toda tabla de negocio.
- `TenantContextService` guarda organización, usuario y rol de la petición en curso. Usa `AsyncLocalStorage` y no un provider request-scoped **a propósito**: un provider request-scoped contagia el scope a todo lo que dependa de él y acabaría reconstruyendo media aplicación en cada petición.
- Se puebla en dos pasos porque `AsyncLocalStorage.run` tiene que envolver todo lo que viene después y un guard no puede hacerlo: devuelve un booleano y el framework sigue por su cuenta. Así que `TenantContextMiddleware` abre un contenedor vacío y `JwtAuthGuard` lo rellena cuando ya sabe quién llama.
- `BaseRepository.scopedWhere()` compone el filtro por organización. El spread va al final para que un `where` de entrada no pueda sobrescribirlo.
- Para actualizar por id se usa `updateMany` y no `update`: acepta un `where` en el que el filtro de organización puede componer, así que un id ajeno no actualiza nada en vez de actualizar la fila de otro cliente.

**Ningún service escribe `organizationId` a mano en una consulta.** Basta un olvido para filtrar datos de otro cliente.

Lo que todavía NO existe y llega cuando el SaaS sea concreto: alta de organizaciones, facturación, invitaciones, subdominios, catálogo maestro con overrides.

### Modelo de datos

- `organizations` — el tenant. De aquí sale **todo** el branding: nombre, logo y textos del PDF. Nunca de constantes.
- `users` · `auth_identities` · `refresh_tokens` — identidad. `passwordHash` es nulo para usuarios solo-Google; `auth_identities` permite tener password y Google a la vez en vez de dos cuentas para el mismo email.
- `categories` · `brands` · `products` · `locations` — catálogo. `caseSize` define cuántas unidades sueltas trae una caja.
- `movements` · `movement_items` — el ledger. Los items guardan `quantityBase` (normalizado con `caseSize`) y un **snapshot** del nombre y la marca, para que un PDF emitido hace un año siga siendo fiel aunque el producto se renombre.
- `stock_levels` — proyección de las existencias. Se actualiza **en la misma transacción** que confirma o anula un movimiento. Se lee en O(1) y siempre es reconstruible desde el ledger.
- `audit_logs` — quién hizo qué, cuándo y desde dónde.

---

## 6. Roles y permisos

Sigue el principio de **segregación de funciones**: quien mueve la mercancía no debe poder alterar los números que la justifican. El control crítico son los ajustes —es donde se esconde un descuadre— por eso están restringidos y exigen motivo.

| Acción | OPERATOR | MANAGER | ORG_ADMIN |
|---|:---:|:---:|:---:|
| Registrar salida (`OUTBOUND`) | ✅ | ✅ | ✅ |
| Registrar entrada (`INBOUND`) | ❌ | ✅ | ✅ |
| Registrar ajuste (`ADJUSTMENT`) | ❌ | ✅ *(motivo obligatorio)* | ✅ |
| Anular un movimiento confirmado | ❌ | ✅ | ✅ |
| Ver historial y existencias | ✅ | ✅ | ✅ |
| Ver reportes | ❌ | ✅ | ✅ |
| CRUD de catálogo | ❌ | ❌ | ✅ |
| Usuarios, roles y organización | ❌ | ❌ | ✅ |
| Log de auditoría | ❌ | ❌ | ✅ |

La matriz vive en **una sola definición declarativa** (`common/permissions/permissions.config.ts`), la consume el `PermissionsGuard` vía `@RequirePermissions()` y se expone en `/auth/me` para que el front oculte lo que corresponda. Nada de `if (user.role === 'admin')` desperdigado: cuando el SaaS necesite roles configurables por organización, se cambia la fuente de la matriz y no cuarenta condicionales.

Cada rol se construye ensanchando el anterior, que es lo que significa aquí la segregación de funciones: el operador mueve mercancía, el manager además corrige los números, y solo el admin toca el catálogo al que esos números se refieren. `PLATFORM_ADMIN` no es asignable por un `ORG_ADMIN` (`ASSIGNABLE_ROLES`).

---

## 7. Convenciones

### Idioma
**Todo lo que vive dentro del código va en inglés**: identificadores, nombres de archivo, columnas, comentarios, mensajes de log y mensajes de commit. El español queda para la documentación del repositorio (`CLAUDE.md`, `README.md`) y para el copy de la interfaz.

### Comentarios

**El comentario por defecto es no escribirlo.** Un comentario es deuda: hay que mantenerlo sincronizado con el código y, cuando deja de estarlo, miente. La mayoría son innecesarios porque el código ya lo dice.

Se escribe un comentario cuando explica **por qué**, no **qué**:

```ts
// ✗ Restata lo que el código ya dice
// Incrementa el contador
counter += 1;

// ✓ Explica una decisión que no se deduce del código
// Grouped by delta: 215 sequential updates blow past Prisma's 5s
// transaction timeout against a remote database.
```

Qué sí merece un comentario:
- Una decisión no obvia y su alternativa descartada.
- Una restricción externa (límite de un proveedor, bug de una librería, requisito legal).
- Una invariante que el tipo no puede expresar.
- JSDoc en lo público cuando el nombre no basta: qué lanza, qué asume.
- `TODO`/`FIXME` con contexto suficiente para actuar.

Qué no:
- Parafrasear la línea siguiente.
- Banners y separadores ASCII para dividir secciones. Si un archivo necesita separadores, necesita partirse en varios.
- Comentar código muerto en vez de borrarlo: para eso está git.
- Encabezados con autor o fecha: eso lo sabe git.

Si un fragmento necesita un comentario para entenderse, primero considera si un nombre mejor o una función extraída lo hacen innecesario.

### Nada quemado
Ni URLs, ni límites, ni textos de negocio, ni nombres de empresa. Configuración → `src/config`. Branding → la fila de `organizations`.

### Datos
- Toda consulta de lista va **paginada por cursor, filtrada y ordenada en el servidor** vía query params. Nunca devolver una colección completa. Usar `CursorPaginationDto`.
- Toda agregación (estadísticas, totales) se hace en SQL, no en JavaScript.
- Cualquier operación que toque `stock_levels` va **dentro de una transacción** junto con el movimiento que la causa.

### Errores
Se lanzan las excepciones HTTP de Nest (`NotFoundException`, `ConflictException`…). El filtro global les da forma uniforme y **nunca deja salir detalles internos**: los mensajes de Prisma incluyen nombres de tabla y de columna, así que se traducen a mensajes genéricos.

### Seguridad
- El `ValidationPipe` global va con `whitelist` y `forbidNonWhitelisted`: lo que no está en el DTO se rechaza con un 400.
- Autorizar **siempre en el backend**. Que el front oculte un botón no es un control.
- Toda consulta de un recurso por id debe verificar que pertenece a la organización del solicitante. Devolver 404, no 403: un 403 confirma que el recurso existe.

### Git

**Nunca añadir a Claude como coautor.** Sin `Co-Authored-By`, sin firmas, sin "Generated with".

**Los mensajes de commit se escriben siempre en inglés**, con formato `type: what changed and why`. Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`.

Trazabilidad sin abrumar: un asunto claro y, si aporta, dos o tres líneas de cuerpo. Nada de cuerpos de veinte líneas.

Un commit reúne un cambio con una sola intención, con un máximo orientativo de **~15 archivos**. Se puede pasar de ahí solo cuando separar sería artificial (un reformateo automático, un renombrado masivo).

---

## 8. Trampas conocidas

- **Prisma 7 exige un driver adapter.** No hay motor embebido por defecto: `PrismaClient` se construye con `PrismaPg`. La documentación de Prisma 6 que circula por internet no aplica.
- **El cliente generado vive en `src/generated/prisma`** y está gitignoreado. Tras clonar hay que correr `npm run db:generate` o nada compila.
- **Solo `PrismaService` y el seed pueden importar `PrismaClient`.** Hay una regla de ESLint que lo impone; los services usan repositorios.
- **Los guards corren antes que los pipes.** El `ValidationPipe` no ha tocado el body cuando `LocalStrategy` lo lee, así que `LoginDto` es documentación y nada más: el email se normaliza en `AuthService.validateCredentials`. Cualquier estrategia de Passport que dependa de un DTO transformado tiene el mismo problema.
- **En un `.env` no existe "ausente".** Una variable sin usar queda como `KEY=""` y llega como cadena vacía, que revienta cualquier `min(1)`. Por eso las variables opcionales pasan por el helper `optional()` de `env.validation.ts`, que convierte `''` en `undefined`.
- **`@Matches` repetido en un mismo campo se pisa.** `class-validator` indexa los errores por nombre de constraint, así que tres `@Matches` reportan uno solo. La política de contraseña usa una única expresión con lookaheads.
- **Cookie cross-site.** El despliegue previsto es Vercel (front) + Render (API) sin dominio propio, así que la cookie de refresh queda cross-site y obligada a `SameSite=None; Secure`, que Safari bloquea por ITP. Funciona en local y en Chrome/Edge/Firefox; el arreglo real es un dominio propio con `app.` y `api.` bajo el mismo padre.
- **`prisma init` instala packs de documentación** en `.agents/`, `.claude/` y `.windsurf/`. Son material de referencia local y están gitignoreados; útiles porque Prisma 7 es muy reciente.

---

## 9. Deuda del proyecto original (contexto histórico)

Por qué las convenciones son las que son. Todo esto es lo que había antes:

- **Sin autenticación de ningún tipo.** Cualquiera con la URL podía listar todos los movimientos, crear movimientos y descargar cualquier PDF por su UUID.
- **Sin validación de entrada.** `POST /api/movimientos` aceptaba cualquier body y lo insertaba.
- **Sin esquema en el repositorio.** No existía un solo `CREATE TABLE`: el esquema vivía únicamente en la instancia de la base de datos.
- **Las líneas de movimiento eran un blob JSON denormalizado**, lo que impedía indexar, agregar y hacer joins — y era la razón de que no pudiera existir el stock.
- **`SELECT * FROM movimientos` sin paginación ni índices**, y las estadísticas agregadas en el navegador sobre el dataset completo.
- **Sin manejo de errores**: una excepción del driver llegaba tal cual al cliente.
- **Sin trazabilidad**: los movimientos guardaban `{id, fecha, licores}`, así que el "audit trail" no podía decir quién hizo nada.
- **Sin existencias**, en un sistema que se anunciaba como de inventario.
