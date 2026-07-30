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
| 3 | Catálogo, inventario con stock, reportes, generación de PDF | ✅ Hecha |

**Con la Fase 3 el backend está completo.** Lo que sigue ocurre entero en el repo del front (Fases 4 a 8); aquí no hay trabajo pendiente salvo lo listado en "Deuda consciente" más abajo.

**Desplegado y funcionando** en Render: `https://beverage-ledger-api.onrender.com`. Ver §4.

Plan completo en el repo del front: `C:\Users\Tomas\.claude\plans\ok-voy-a-hacerle-tender-sprout.md`

### Dónde quedó la Fase 1

Todo verificado, no solo compilado. Migraciones aplicadas y seed ejecutado **contra Supabase**: 215 productos, 14 categorías, 160 marcas, 41 movimientos, 400 líneas, 12.745 unidades de stock.

La invariante del ledger se comprueba con esta consulta, que debe devolver `descuadres = 0` y `total_ledger = total_proyeccion`. Desde la Fase 3 `quantity_base` va **con signo**, así que es una suma directa y ya no hace falta reconstruir la dirección con un `CASE`:

```sql
WITH ledger AS (
  SELECT mi.product_id, SUM(mi.quantity_base) AS from_ledger
  FROM movement_items mi
  JOIN movements m ON m.id = mi.movement_id
  WHERE m.status = 'CONFIRMED'
  GROUP BY mi.product_id
)
SELECT
  (SELECT COUNT(*) FROM ledger l JOIN stock_levels s ON s.product_id = l.product_id
     WHERE s.quantity_base <> l.from_ledger) AS descuadres,
  (SELECT SUM(from_ledger) FROM ledger) AS total_ledger,
  (SELECT SUM(quantity_base) FROM stock_levels) AS total_proyeccion,
  (SELECT COUNT(*) FROM stock_levels WHERE quantity_base < 0) AS niveles_negativos;
```

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

### Dónde quedó la Fase 3

Verificado contra Supabase, no solo compilado: ciclo completo de movimiento con las existencias cuadrando al final, matriz de permisos ejercida con un usuario `OPERATOR` real, e invariante del ledger en cero descuadres. El contrato OpenAPI expone **30 rutas y 58 esquemas** en `/docs-json`.

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/products` · `/products/:id` | autenticado |
| `POST` `PATCH` | `/products` · `/products/:id` | `catalog:manage` |
| `GET` | `/categories` · `/brands` (+ `/:id`) | autenticado |
| `POST` `PATCH` `DELETE` | `/categories` · `/brands` (+ `/:id`) | `catalog:manage` |
| `GET` | `/movements` · `/movements/:id` | `movement:read` |
| `POST` `PATCH` | `/movements` · `/movements/:id` | según el **tipo** del movimiento |
| `POST` | `/movements/:id/confirm` | según el **tipo** del movimiento |
| `POST` | `/movements/:id/cancel` | `movement:cancel` |
| `GET` | `/movements/:id/pdf` | `movement:read` |
| `GET` | `/stock` · `/stock/low` · `/stock/:productId/kardex` | `stock:read` |
| `GET` | `/reports/summary` · `/consumption` · `/activity` | `report:read` |
| `GET` `PATCH` | `/organization` | `organization:manage` |
| `GET` | `/audit-logs` | `audit:read` |

Decisiones que quedaron tomadas al construirlo:

- **`quantity_base` va con signo.** El seed lo escribía como magnitud sin signo y guardaba la dirección solo en `movements.type`, así que leer el ledger exigía reconstruirla con un `CASE` y un ajuste **no tenía forma de corregir hacia abajo**. Con signo, `SUM(quantity_base)` sobre movimientos confirmados *es* la existencia. Una migración volteó las líneas de salida ya escritas.
- **`movements.code` sale de `movement_counters`**, una fila por organización y año, incrementada dentro de la transacción que crea el movimiento. Una secuencia de Postgres no servía: no se puede declarar una por tenant y deja huecos al hacer rollback. La primera extracción de cada año **se auto-inicializa desde el código más alto que ya exista** en el ledger, porque el seed numera por su cuenta y empezar en 1 chocaría.
- **El código se asigna al crear, y un movimiento nunca se borra.** Un borrador se anula, no se elimina, así que la serie no tiene huecos y se ve que el MOV-000042 se empezó y se abandonó.
- **La auditoría se escribe explícita desde cada caso de uso**, no con un interceptor. Un interceptor solo ve la forma HTTP: no sabe nombrar la entidad ni qué cambió, y la entrada de una confirmación tiene que confirmarse o revertirse *con* el movimiento. `AuditService.record()` es best-effort (no tumba un login), `recordIn(tx, …)` entra en la transacción del que llama y sí propaga el fallo.
- **El stock nunca queda negativo, tampoco por ajuste.** Un conteo físico no da negativo, así que un ajuste que deje el nivel bajo cero es un error de captura. La guarda viaja **dentro** del `UPDATE` (`quantity_base >= -delta`); una lectura previa aparte solo existe para poder decir qué producto falta y cuánto.
- **Los deltas se agrupan por valor**, no por línea: el movimiento de apertura tiene 215 líneas y una sentencia por línea revienta el timeout de transacción contra una base remota.
- **Una salida o entrada con cantidad negativa se rechaza.** Sin eso, una salida negativa es una entrada registrada por quien nunca recibió ese permiso: se cae la segregación de funciones.
- **Crear y confirmar no llevan decorador de permiso**, porque cuál aplica depende del tipo guardado en el registro y ningún decorador estático lo ve. El mapa tipo→permiso vive en `permissions.config.ts`, junto a la matriz, y lo lee el service. **No es una excepción a "autorizar en el guard": es la misma definición declarativa, consultada donde sí se conoce el dato.**
- **Los productos no se borran**, se desactivan: el ledger los referencia. Categorías y marcas sí se borran, pero solo si ningún producto las usa.
- **Un rango de reporte omitido son los últimos 30 días**, para que una llamada sin filtros no sea un scan completo. `activity` agrupa en la zona horaria de la organización, no la del servidor.

### Deuda consciente que queda en este repo

- **Credenciales de Google OAuth** sin crear en Google Cloud Console (ver arriba). Nada más depende de ello.
- **La estructura del documento PDF queda pendiente de revisión.** El layout actual es una migración del que había en el front, con las columnas reducidas a lo que el ledger realmente guarda: nombre y marca del snapshot, cantidad, unidad y unidades base. El resto de los campos del original (origen, ABV, añejamiento, subcategoría) vivían en el blob JSON denormalizado y ahora están en `products`, no en la línea del movimiento — meterlos en el documento significa decidir si se leen del producto actual (y entonces un reimpreso viejo deja de ser fiel) o si el snapshot debe crecer. **Es una decisión de producto, no de código, y se aborda en una fase posterior** junto con la revisión visual del layout.
- **El PDF usa las fuentes estándar**, que son WinAnsi: 218 caracteres, Windows-1252. Cubre los acentos del español, la raya y las comillas curvas, y `drawText` **lanza excepción** con cualquier cosa fuera de ese juego. `movement-pdf.service.ts` le pregunta a la fuente qué soporta y solo pliega lo que de verdad no cabe (a su letra base, o a `?` como último recurso). El arreglo definitivo es embeber una fuente Unicode, a costa de versionar un archivo de fuente.
- **Sin infraestructura de tests**, por decisión del usuario: es el trabajo de V&V del semestre. Los guiones que verificaron esta fase fueron de un solo uso y no están versionados.

---

## 3. Comandos

**El gestor de paquetes es pnpm**, fijado en `packageManager` del `package.json`. No uses `npm install` en este repo: generaría un `package-lock.json` paralelo y te saltarías la configuración de seguridad de abajo.

```bash
pnpm install                    # instalar dependencias (genera el cliente Prisma)
pnpm install --frozen-lockfile  # lo que hace CI: falla si el lockfile no cuadra

pnpm start:dev        # desarrollo con watch, en :3001
pnpm build            # compila a dist/
pnpm start:prod       # sirve el build

pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm format           # Prettier

pnpm db:migrate       # prisma migrate dev
pnpm db:generate      # regenera el cliente en src/generated/prisma
pnpm db:seed          # catálogo completo, stock en CERO
pnpm db:seed:demo     # además, stock simulado e histórico de salidas
pnpm db:studio        # inspector de datos
pnpm db:reset         # borra y rehace todo (destructivo)
```

Postgres local para desarrollo: `docker compose up -d`. Levanta dos bases — la de trabajo en el puerto **5434** (no 5432, para no chocar con un Postgres instalado en la máquina) y la de sombra en el **5433**.

### Por qué pnpm, y qué protege de verdad

Misma postura que el repo del front, y por las mismas razones. pnpm instala **del mismo registro que npm**: no te salva de que un paquete publique una versión comprometida. Lo que aporta está en `pnpm-workspace.yaml`:

- **Ningún paquete puede correr scripts de instalación** (`onlyBuiltDependencies` vacío). Es el vector que usó el gusano Shai-Hulud en 2025, y en npm los `postinstall` corren todos sin preguntar. Cinco paquetes piden uno y **ninguno lo necesita**, comprobado: `prisma` y `@prisma/engines` (el generador `prisma-client` con driver adapters no descarga motor), `argon2` y `esbuild` (traen binarios precompilados como dependencias opcionales) y `@scarf/scarf`, que es telemetría de instalación que no tenemos por qué ejecutar.
- **Cuarentena de 24h** (`minimumReleaseAge: 1440`), que solo afecta a resolver dependencias nuevas, no a instalar desde el lockfile.
- **`node_modules` estricto**: un paquete solo ve lo que declara.

`prisma generate` se movió al `postinstall` **del propio repo**, que sí corre porque `onlyBuiltDependencies` solo restringe a las dependencias. Así un clone nuevo compila tras un único `pnpm install`, sin tener que darle permiso de ejecución a `@prisma/client`.

### Avisos de seguridad

Queda **1 abierto a propósito**: GHSA-mh99-v99m-4gvg contra `brace-expansion`, por la vía `@eslint/eslintrc > minimatch@3`. La 1.1.17 ya es la última de su línea y el aviso solo se considera corregido en `>=5.0.8`, cuya exportación CommonJS pasó a ser un objeto namespace que `minimatch@3` no puede invocar — forzarlo lo rompe en cualquier patrón con llaves, y ESLint sigue saliendo limpio, así que no se notaría. La vía real es que los consumidores suban a `minimatch@10`, que en este mismo árbol ya convive con `brace-expansion@5`. Es un DoS en tooling de desarrollo, con patrones de nuestra propia config.

**No escribas los overrides con `pnpm audit --fix`**: emite reemplazos tipo `'>=5.2.2'` que pnpm resuelve a la versión más alta del registro y cruzan de major en silencio. Y **nunca `audit fix --force`**.

---

## 4. Configuración y bases de datos

Hay **dos conexiones al mismo Postgres** y no son intercambiables:

| Variable | Puerto Supabase | Quién la usa |
|---|---|---|
| `DATABASE_URL` | 6543, pooler en modo transacción | La aplicación en runtime, vía el driver adapter |
| `DIRECT_URL` | 5432, conexión directa o pooler en modo sesión | La CLI de Prisma, para migrar |

El pooler en modo transacción **no puede ejecutar migraciones**. El reparto está hecho en `prisma.config.ts` (migraciones → `DIRECT_URL`) y en `src/infra/prisma/prisma.service.ts` (runtime → `DATABASE_URL`).

`SHADOW_DATABASE_URL` apunta al Postgres de docker-compose: `migrate dev` necesita crear y destruir una base para detectar drift, y el rol de aplicación de Supabase no puede. Solo hace falta en desarrollo — `migrate deploy` no usa base de sombra, y por eso `prisma.config.ts` la lee con `process.env` y no con el helper `env()` de Prisma, que **lanza** cuando la variable falta y rompería el build de despliegue.

Si una contraseña contiene `/ % @ :` hay que **URL-encodearla** o la conexión falla con un error de parseo poco descriptivo.

`JWT_SECRET` es obligatoria y de 32 caracteres mínimo; genérala con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Las de Google son opcionales pero se validan **como conjunto**: las tres o ninguna, para que una configuración a medias falle al arrancar y no en mitad del callback.

**Ningún módulo lee `process.env` directamente.** Todo pasa por `src/config/configuration.ts`, que valida el entorno con Zod al arrancar y llega tipado vía `ConfigService<AppConfig, true>`. Si falta o está mal una variable, el proceso no arranca — a diferencia del proyecto original, que fallaba en la primera consulta con un error indescifrable.

### Despliegue

La API vive en **Render** (`https://beverage-ledger-api.onrender.com`) y el front en **Vercel**, descritos en `render.yaml`. Los secretos van marcados `sync: false`: Render los pide una vez en el panel y nunca tocan el repositorio.

Las migraciones corren en el `buildCommand`, no al arrancar: `migrate deploy` es idempotente y un fallo debe abortar el despliegue en vez de dejar una instancia en bucle de reinicio. El *pre-deploy hook* de Render, que es donde corresponderían, es de pago.

Detalles que costaron un despliegue fallido cada uno:

- **`PORT` la inyecta Render.** Declararla en el blueprint pisaría el binding.
- **`FRONTEND_URL` es `z.url()`**, así que sin `https://` no arranca. Dejar el campo en blanco en el panel produce cadena vacía, que es la misma trampa del `.env` de §8.
- **`CORS_ORIGINS` no valida nada** (`z.string()`), así que un valor roto no falla al arrancar: falla en el navegador. Es lista separada por comas e incluye `http://localhost:3000` a propósito, para poder correr el front local contra la API desplegada — el camino cuando la red de turno bloquea el puerto de Supabase.
- **`NODE_ENV=production` cambia la cookie de refresh** a `Secure; SameSite=None`. Ver la trampa de Safari en §8.
- **El plan free duerme a los 15 minutos** y despertar cuesta ~50s. Un cron externo cada 10 minutos contra `/api/v1/health` lo evita y de paso impide que Supabase se pause por inactividad, pero 24/7 consume ~730 de las 750 horas mensuales del plan: entra un servicio free, no dos.

`SEED_ADMIN_PASSWORD` **no** está en Render: la lee el seed, no la API. La credencial del admin vive como hash argon2 en `users.password_hash`.

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
    auth/  users/  organizations/  audit/
    catalog/           products · categories · brands
    inventory/         movements · stock · kardex · locations
    reports/           agregación en SQL
    documents/         render del PDF de un movimiento
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
- Se puebla en dos pasos porque `AsyncLocalStorage.run` tiene que envolver todo lo que viene después y un guard no puede hacerlo: devuelve un booleano y el framework sigue por su cuenta. Así que `TenantContextMiddleware` abre un contenedor vacío y `JwtAuthGuard` lo rellena cuando ya sabe quién llama.
- `BaseRepository.scopedWhere()` compone el filtro por organización. El spread va al final para que un `where` de entrada no pueda sobrescribirlo.
- Para actualizar por id se usa `updateMany` y no `update`: acepta un `where` en el que el filtro de organización puede componer, así que un id ajeno no actualiza nada en vez de actualizar la fila de otro cliente.

**Ningún service escribe `organizationId` a mano en una consulta.** Basta un olvido para filtrar datos de otro cliente.

Lo que todavía NO existe y llega cuando el SaaS sea concreto: alta de organizaciones, facturación, invitaciones, subdominios, catálogo maestro con overrides.

### Modelo de datos

- `organizations` — el tenant. De aquí sale **todo** el branding: nombre, logo y textos del PDF. Nunca de constantes.
- `users` · `auth_identities` · `refresh_tokens` — identidad. `passwordHash` es nulo para usuarios solo-Google; `auth_identities` permite tener password y Google a la vez en vez de dos cuentas para el mismo email.
- `categories` · `brands` · `products` · `locations` — catálogo. `caseSize` define cuántas unidades sueltas trae una caja.
- `movements` · `movement_items` — el ledger. Los items guardan `quantityBase` (normalizado con `caseSize` y **con signo**: negativo resta) y un **snapshot** del nombre y la marca, para que un PDF emitido hace un año siga siendo fiel aunque el producto se renombre.
- `movement_counters` — de dónde sale `movements.code`, una fila por organización y año. Ver §2.
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
- **El cliente generado vive en `src/generated/prisma`** y está gitignoreado. Tras clonar se genera solo en el `postinstall`; si hace falta rehacerlo, `pnpm db:generate`.
- **Solo `PrismaService` y el seed pueden importar `PrismaClient`.** Hay una regla de ESLint que lo impone; los services usan repositorios.
- **Los guards corren antes que los pipes.** El `ValidationPipe` no ha tocado el body cuando `LocalStrategy` lo lee, así que `LoginDto` es documentación y nada más: el email se normaliza en `AuthService.validateCredentials`. Cualquier estrategia de Passport que dependa de un DTO transformado tiene el mismo problema.
- **En un `.env` no existe "ausente".** Una variable sin usar queda como `KEY=""` y llega como cadena vacía, que revienta cualquier `min(1)`. Por eso las variables opcionales pasan por el helper `optional()` de `env.validation.ts`, que convierte `''` en `undefined`.
- **`@Matches` repetido en un mismo campo se pisa.** `class-validator` indexa los errores por nombre de constraint, así que tres `@Matches` reportan uno solo. La política de contraseña usa una única expresión con lookaheads.
- **Cookie cross-site.** El despliegue previsto es Vercel (front) + Render (API) sin dominio propio, así que la cookie de refresh queda cross-site y obligada a `SameSite=None; Secure`, que Safari bloquea por ITP. Funciona en local y en Chrome/Edge/Firefox; el arreglo real es un dominio propio con `app.` y `api.` bajo el mismo padre.
- **`prisma init` instala packs de documentación** en `.agents/`, `.claude/` y `.windsurf/`. Son material de referencia local y están gitignoreados; útiles porque Prisma 7 es muy reciente.
- **`migrate dev` necesita Docker levantado** para la base de sombra. Sin él, la alternativa es generar el SQL comparando contra la base viva y aplicarlo con `deploy`:

  ```bash
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
  npx prisma migrate deploy
  ```

  Los flags cambiaron en Prisma 7: `--from-schema-datasource` ya no existe.
- **`SUM()` y `COUNT()` en Postgres devuelven `bigint`**, que no sobrevive a `JSON.stringify`. Toda agregación cruda lleva `::int` en la consulta, o `Number()` al salir del repositorio.
- **`CREATE EXTENSION` no se declara en el esquema.** Exige el preview feature `postgresqlExtensions`, y fijarle esquema (Supabase guarda las extensiones en `extensions`) rompería el Postgres local, que no tiene ese esquema. `pg_trgm` se crea sin calificar dentro de la migración.

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
