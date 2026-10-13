# Pruebas de API — movimientos, existencias y reportes

Esta suite verifica el **contrato HTTP** de los endpoints de movimientos,
existencias y reportes de Beverage Ledger API. Sigue la metodología del ejemplo `api-testing` del curso
(FastAPI + `TestClient`), adaptada al stack real del proyecto: **NestJS + Vitest + Chai**.

Las pruebas levantan la API en memoria, en un puerto efímero, y le hablan por HTTP
real con `fetch`. No hace falta iniciar el servidor ni tener PostgreSQL.

## Qué es real y qué es doble

| Capa | En la suite |
|---|---|
| Controladores (`MovementsController`, `DocumentsController`, `StockController`, `ReportsController`) | reales |
| Prefijo `api/v1`, `ValidationPipe` global, `AllExceptionsFilter` | reales, mismas opciones que `main.ts` |
| `PermissionsGuard` y matriz de permisos | reales |
| Servicios (`MovementsService`, `DocumentsService`, `MovementPdfService`, `ProductsService`, `LocationsService`, `OrganizationsService`, `AuditService`, `StockService`, `ReportsService`) | reales |
| `TenantContextService` + middleware | reales |
| `JwtAuthGuard` | sustituido por un guard de prueba que lee el rol del header `x-test-role` (sin header → 401) |
| Repositorios Prisma | sustituidos por un ledger en memoria (`support/in-memory-ledger.ts`) |

## Alcance

| RF | Archivo | Endpoints |
|---|---|---|
| RF-15 Registrar salida (OUTBOUND) | `rf-15-api-outbound.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-16 Registrar entrada (INBOUND) | `rf-16-api-inbound.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-17 Registrar traspaso (TRANSFER) | `rf-17-api-transfer.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-18 Registrar ajuste (ADJUSTMENT) | `rf-18-api-adjustment.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-19 Retomar un borrador | `rf-19-api-draft.test.ts` | `GET /movements?type&status=DRAFT&createdByUserId`, `PATCH /movements/:id` |
| RF-20 Anular movimiento confirmado | `rf-20-api-cancel.test.ts` | `POST /movements/:id/cancel` |
| RF-21 Descargar comprobante PDF | `rf-21-api-pdf.test.ts` | `GET /movements/:id/pdf` |
| RF-22 Consultar existencias | `rf-22-api-stock-levels.test.ts` | `GET /stock` (paginación, `productIds`) |
| RF-23 Filtrar existencias | `rf-23-api-filter-stock.test.ts` | `GET /stock?search&categoryId&locationId` |
| RF-24 Kardex de un producto | `rf-24-api-kardex.test.ts` | `GET /stock/:productId/kardex` |
| RF-27 Bajo mínimo | `rf-27-api-low-stock.test.ts` | `GET /stock/low` |
| RF-28 Reporte de consumo | `rf-28-api-consumption.test.ts` | `GET /reports/consumption`, `GET /reports/summary` |

Aspectos verificados: métodos y rutas reales, códigos `200`, `201`, `400`, `401`,
`403`, `404` y `409`, estructura del JSON de respuesta y del cuerpo de error,
validación del body y de los query params, recursos inexistentes, efecto sobre
las existencias, paginación (`meta`), saldo corrido del kardex, agrupación del
consumo y cabeceras/firma del PDF.

## Ejecutar

Desde la raíz de `beverage-ledger-api`:

```bash
pnpm test:api
```

Un archivo:

```bash
pnpm vitest run test/api/rf-20-api-cancel.test.ts
```

Una prueba por nombre:

```bash
pnpm vitest run test/api -t "cancelling a movement twice"
```

`pnpm test` también la incluye, junto con el resto de `test/`.

## Nota sobre FIRST

Cada archivo levanta la aplicación una vez (`beforeAll`) y el `beforeEach`
restaura el ledger en memoria a la semilla, igual que la fixture
`restaurar_productos` del ejemplo: ninguna prueba depende de lo que otra escribió.

## Comportamientos observados

- `POST /movements/:id/confirm` y `POST /movements/:id/cancel` responden **201**,
  no 200: son `@Post` sin `@HttpCode`, aunque Swagger los documenta con
  `@ApiOkResponse`. Las pruebas validan el comportamiento real.
- `GET /movements/:id/pdf` declara `@Header('Content-Type', 'application/pdf')`,
  que también se aplica a las respuestas de error: el 400/404 trae el cuerpo JSON
  correcto pero etiquetado como `application/pdf`.
