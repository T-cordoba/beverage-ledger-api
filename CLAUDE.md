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
| 2 | Auth: Passport local + Google OAuth, JWT, refresh rotativo, permisos | 🔄 **En curso** |
| 3 | Catálogo, inventario con stock, reportes, generación de PDF | ⬜ Pendiente |

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

### Punto de partida de la Fase 2

Lo que hay que construir, con las decisiones ya tomadas:

1. **`common/permissions/permissions.config.ts`** — la matriz de §6 como una sola estructura declarativa. Se hace primero porque el guard y `/auth/me` dependen de ella.
2. **Estrategia local** con `passport-local` y `argon2` (no bcrypt). Política de contraseña, bloqueo por intentos y respuestas que **no revelan si un email existe**.
3. **Estrategia Google** con `passport-google-oauth20` y parámetro `state`. Si el email ya existe con contraseña, se vincula en `auth_identities` en vez de crear una segunda cuenta.
4. **Tokens** — access JWT corto que el front guarda en memoria, refresh rotativo en cookie httpOnly. `refresh_tokens` ya tiene `tokenHash`, `revokedAt` y `replacedById` para detectar reuso.
5. **Guards** — `JwtAuthGuard` global con decorador `@Public()`, `RolesGuard` alimentado por la matriz, y `@CurrentUser()`.
6. **Poblar el `TenantContextService`** desde el usuario autenticado. Hoy nadie lo llama, así que `BaseRepository` falla ruidosamente a propósito; ese es el eslabón que cierra la Fase 2.
7. **`/auth/me`** devolviendo usuario, organización y permisos efectivos, que es lo que el front consume para ocultar lo que no aplique.
8. **Módulo de usuarios** — perfil, cambio de contraseña, listado y gestión para el panel de administración.

Detalles que hay que tener en cuenta:

- El usuario sembrado `admin@beverageledger.local` tiene `passwordHash` en null y `status: INVITED`. La Fase 2 debe darle una forma de establecer contraseña, o el seed debe pasar a generarla.
- Falta añadir al entorno: `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`. Van en `src/config/env.validation.ts` con Zod, nunca leídos desde `process.env`.
- Los endpoints de autenticación necesitan un rate limit propio, más estricto que el global de 120/min.
- **Requiere acción del usuario**: crear las credenciales OAuth en Google Cloud Console. Consent screen tipo *External* en modo *Testing*, scopes solo `email` y `profile`, cliente de tipo *Web application*, y redirect URI `http://localhost:3001/api/v1/auth/google/callback` — que debe coincidir carácter por carácter con la que configure Passport, porque es el error número uno de este flujo.

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
    filters/           respuesta de error uniforme
    dto/               paginación por cursor y tipos compartidos
    tenant/            TenantContextService (AsyncLocalStorage)
    repositories/      BaseRepository con scoping automático
  infra/prisma/        PrismaService y PrismaModule
  modules/             un módulo por dominio
    health/
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
- `BaseRepository.scopedWhere()` compone el filtro por organización. El spread va al final para que un `where` de entrada no pueda sobrescribirlo.

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

La matriz vivirá en **una sola definición declarativa** (`common/permissions/permissions.config.ts`, Fase 2), la consumirá el `RolesGuard` y se expondrá en `/auth/me` para que el front oculte lo que corresponda. Nada de `if (user.role === 'admin')` desperdigado: cuando el SaaS necesite roles configurables por organización, se cambia la fuente de la matriz y no cuarenta condicionales.

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
