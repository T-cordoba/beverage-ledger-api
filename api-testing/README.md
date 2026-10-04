# Pruebas de API — movimientos de inventario

Esta suite verifica el **contrato HTTP** de los endpoints de movimientos de
Beverage Ledger API. Sigue la metodología del ejemplo `api-testing` del curso
(FastAPI + `TestClient`), adaptada al stack real del proyecto: **NestJS + Vitest + Chai**.

Las pruebas levantan la API en memoria, en un puerto efímero, y le hablan por HTTP
real con `fetch`. No hace falta iniciar el servidor ni tener PostgreSQL.

## Qué es real y qué es doble

| Capa | En la suite |
|---|---|
| Controladores (`MovementsController`, `DocumentsController`) | reales |
| Prefijo `api/v1`, `ValidationPipe` global, `AllExceptionsFilter` | reales, mismas opciones que `main.ts` |
| `PermissionsGuard` y matriz de permisos | reales |
| Servicios (`MovementsService`, `DocumentsService`, `MovementPdfService`, `ProductsService`, `LocationsService`, `OrganizationsService`, `AuditService`) | reales |
| `TenantContextService` + middleware | reales |
| `JwtAuthGuard` | sustituido por un guard de prueba que lee el rol del header `x-test-role` (sin header → 401) |
| Repositorios Prisma | sustituidos por un ledger en memoria (`support/in-memory-ledger.ts`) |

## Alcance

| RF | Archivo | Endpoints |
|---|---|---|
| RF-15 Registrar salida (OUTBOUND) | `tests/rf-15-api-outbound.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-16 Registrar entrada (INBOUND) | `tests/rf-16-api-inbound.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-17 Registrar traspaso (TRANSFER) | `tests/rf-17-api-transfer.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-18 Registrar ajuste (ADJUSTMENT) | `tests/rf-18-api-adjustment.test.ts` | `POST /movements`, `POST /movements/:id/confirm` |
| RF-20 Anular movimiento confirmado | `tests/rf-20-api-cancel.test.ts` | `POST /movements/:id/cancel` |
| RF-21 Descargar comprobante PDF | `tests/rf-21-api-pdf.test.ts` | `GET /movements/:id/pdf` |

Aspectos verificados: métodos y rutas reales, códigos `200`, `201`, `400`, `401`,
`403`, `404` y `409`, estructura del JSON de respuesta y del cuerpo de error,
validación del body, recursos inexistentes, efecto sobre las existencias y
cabeceras/firma del PDF.

## Ejecutar

Desde la raíz de `beverage-ledger-api`:

```bash
pnpm test:api
```

Un archivo:

```bash
pnpm vitest run api-testing/tests/rf-20-api-cancel.test.ts
```

Una prueba por nombre:

```bash
pnpm vitest run api-testing -t "cancelling a movement twice"
```

`pnpm test` también la incluye, junto con `test/`.

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
