# Pruebas E2E — movimientos de inventario

Pruebas de extremo a extremo de RF-15, RF-16, RF-17, RF-18, RF-20 y RF-21 sobre la
**API real levantada**: base de datos PostgreSQL de verdad, login real con JWT,
guards, servicios, repositorios y transacciones de producción. Nada se simula; la
prueba le habla a la API por HTTP como lo hace el frontend.

Es la contraparte de la E2E del front (`beverage-ledger/tests/e2e`). Allí la actriz
Camila navega la UI; aquí recorre los mismos flujos directamente contra la API.

## El patrón Screenplay sin dependencias nuevas

El repositorio de referencia `serenityjs-e2e-testing` usa Serenity/JS + Cucumber.
Este repo corre sobre **Vitest + Chai** y no incorpora herramientas de prueba nuevas
(CLAUDE.md §2), así que el patrón está implementado en pocas líneas con los mismos
nombres y la misma forma de Serenity/JS:

| Elemento | Qué es aquí | Dónde vive |
|---|---|---|
| **Actor** | Camila, con su diario de lo que intentó | `screenplay/core.ts` |
| **Abilities** | `CallAnApi` (HTTP con bearer token) y `TakeNotes` (recordar entre pasos) | `screenplay/abilities.ts` |
| **Interactions** | Lo atómico: `Send`, `Authenticate`, `OpenADraft`, `ConfirmTheMovement`, `CancelTheMovement`, `DownloadTheReceipt` | `screenplay/tasks.ts` |
| **Tasks** | Metas de negocio compuestas: `RegisterMovement` (borrador + confirmar), `VoidWhatWasLeftBehind` | `screenplay/tasks.ts` |
| **Questions** | `LastResponse`, `StockLevel`, `TheMovement`, `LatestKardexEntry` | `screenplay/questions.ts` |
| **Ensure** | `Ensure.that(pregunta, expectativa)` con expectativas nombradas como en `@serenity-js/assertions` | `screenplay/core.ts`, `screenplay/expectations.ts` |
| **Escena** | El actor autenticado y los datos descubiertos por la API (bodegas, producto con stock) | `support/stage.ts` |

Los escenarios no contienen `fetch` ni rutas sueltas: piden al actor que *intente*
tareas y que *compruebe* respuestas a preguntas.

## Escenarios

| RF | Archivo | Qué comprueba |
|---|---|---|
| RF-15 | `rf-15-e2e-outbound.test.ts` | Una salida confirmada baja el stock y queda en el kardex con su código y saldo · una salida mayor al stock responde 400 y no mueve nada · sin sesión, 401 |
| RF-16 | `rf-16-e2e-inbound.test.ts` | Una entrada por caja sube el stock en `caseSize` botellas · confirmar dos veces responde 409 y suma una sola vez · cantidad negativa, 400 |
| RF-17 | `rf-17-e2e-transfer.test.ts` | Un traspaso escribe −N en origen y +N en destino y conserva el total · destino igual al origen, 400 · más de lo que hay en origen, 400 sin mover nada |
| RF-18 | `rf-18-e2e-adjustment.test.ts` | Un ajuste negativo con motivo baja el stock y guarda el motivo · motivo de menos de 4 caracteres, 400 · un ajuste que dejaría stock negativo, 400 sin cambios |
| RF-20 | `rf-20-e2e-cancel.test.ts` | Anular devuelve el stock y conserva el movimiento `CANCELLED` con su código y su línea original · anular dos veces, 409 y devuelve una sola vez · sin motivo, 400 y sigue confirmado |
| RF-21 | `rf-21-e2e-pdf.test.ts` | El comprobante descarga como PDF adjunto llamado `<código>.pdf` · movimiento inexistente, 404 · sin sesión, 401 y sin documento |

## Datos seguros

- **Cada movimiento creado se anula** al terminar el escenario (`VoidWhatWasLeftBehind`),
  aunque el escenario falle a la mitad. Todos llevan la nota `E2E backend test`.
- Un movimiento anulado **queda en el historial** (el ledger es inmutable), por eso la
  suite **solo escribe contra `localhost`**. Para otra URL hay que pedirlo a conciencia
  con `E2E_ALLOW_REMOTE_WRITES=true`; si no, se omite.
- Nada se asume del catálogo: la escena descubre la bodega por defecto, una segunda
  bodega y un producto con stock. Vitest ejecuta los archivos en paralelo, así que
  cada uno es **dueño de una parte disjunta del catálogo**, repartida por el id del
  producto (`PRODUCT_SLOT`), y elige solo dentro de ella. Repartir por ranking de
  stock no sirve: los archivos arrancan en momentos distintos, para entonces otro ya
  movió existencias y dos acaban con el mismo producto.
- Al terminar, el invariante del ledger de CLAUDE.md §2 debe seguir en cero descuadres.

## Cómo correrlas

Sin `E2E_API_URL` la suite se **omite**: `pnpm test` y la etapa de cobertura de
Jenkins siguen funcionando sin servidor ni red.

1. Postgres local y datos: `docker compose up -d db`; con `DATABASE_URL` y `DIRECT_URL`
   en `postgresql://postgres:postgres@localhost:5434/beverage_ledger`,
   `pnpm exec prisma migrate deploy` y `SEED_MODE=demo SEED_ADMIN_PASSWORD=... pnpm exec prisma db seed`.
2. API: `pnpm build` y `node dist/main` con esas variables más `JWT_SECRET` (32+ caracteres).
3. Una **segunda bodega** (`POST /api/v1/locations` como admin): el seed trae una sola y RF-17 necesita destino.
4. Ejecutar:

   ```bash
   E2E_API_URL=http://localhost:3001 \
   TEST_USER_EMAIL=admin@beverageledger.local TEST_USER_PASSWORD=<SEED_ADMIN_PASSWORD> \
   pnpm vitest run test/e2e
   ```

   En PowerShell: `$env:E2E_API_URL='http://localhost:3001'; $env:TEST_USER_EMAIL='...'; $env:TEST_USER_PASSWORD='...'; pnpm vitest run test/e2e`.

   Un solo RF: `pnpm vitest run test/e2e/rf-20-e2e-cancel.test.ts`.

**Los límites de la API.** Acepta 120 peticiones por minuto por IP, y 10 logins
(`AUTH_THROTTLE`); los seis archivos comparten IP. `CallAnApi` trata un 429 como lo
que es —el throttle, no el comportamiento bajo prueba—, espera lo que indica
`Retry-After` (60 s) y reintenta. Por eso dos corridas seguidas pueden tardar un
minuto más, y por eso los escenarios y los hooks llevan un timeout de 180 s.

**Las consultas no pisan la respuesta.** Las preguntas (`StockLevel`, `TheMovement`…)
leen con `CallAnApi.read`, que exige un 200 y falla con el status y el cuerpo reales.
`LastResponse` solo sigue lo que el actor *envió*, como en Serenity/JS.
