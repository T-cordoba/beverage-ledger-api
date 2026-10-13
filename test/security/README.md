# Pruebas de seguridad — movimientos, existencias y reportes

Suite de **security testing** para RF-15 a RF-24, RF-27 y RF-28 de Beverage
Ledger API. No repite los casos funcionales de `test/api/` ni de
`test/regression/`: verifica riesgos de seguridad sobre la implementación real
(autenticación JWT, matriz de permisos, aislamiento por organización, validación,
concurrencia y fuga de información en errores).

Stack: **NestJS + Vitest**, sin dependencias nuevas. La API se levanta en memoria en
un puerto efímero y se le habla por HTTP real con `fetch`. No necesita PostgreSQL.

## Qué es real y qué es doble

| Capa | En la suite |
|---|---|
| `JwtAuthGuard` + `JwtStrategy` (passport-jwt, HS256, expiración) | **reales** — tokens firmados de verdad |
| `AuthService.resolveTokenSubject` + `AuthRepository` (relee el usuario en cada petición) | **reales** |
| `PermissionsGuard` y matriz `permissions.config.ts` | reales |
| Controladores, servicios y **repositorios** (incluido `BaseRepository.scopedWhere`) | reales |
| `helmet`, `cookie-parser`, `ValidationPipe`, `AllExceptionsFilter(isProduction=true)` | reales, mismo orden y opciones que `main.ts` |
| `PrismaService` | sustituido por `support/fake-prisma.ts`: base en memoria con **dos organizaciones** |

A diferencia de `test/api/` (que reemplaza repositorios y el guard JWT), aquí solo
se reemplaza el cliente Prisma. El fake aplica **exactamente** el `where` que recibe:
si un repositorio olvidara `organizationId`, devolvería filas del otro tenant y las
pruebas de aislamiento fallarían (comprobado mutando el fake: fallan las 9).

Las transacciones del fake se serializan y hacen *rollback* ante error, como
PostgreSQL, para que las aserciones de "no cambió nada" tengan sentido.

Las suites de RF-19, RF-22, RF-23, RF-24, RF-27 y RF-28 corren sobre la
infraestructura de `test/api/`: el rol llega en el header `x-test-role` y los
repositorios son los del ledger en memoria, con una segunda organización que
siembra `seedOtherTenant()`. Pipes, guards, servicios y `AllExceptionsFilter` son
los reales. Los espías sobre `api.repositories` comprueban qué llegó al repositorio
y que una entrada rechazada no llegó. `support/safe-error.ts` verifica la forma del
cuerpo de error y que no lleve trazas, rutas de código ni detalles de la base.

## Alcance

| RF | Archivo | Riesgos verificados |
|---|---|---|
| RF-15 Salida | `rf-15-security-outbound.test.ts` | autenticación (sin token, firma ajena, expirado, `alg:none`, payload alterado, esquema incorrecto, token en query/cookie, usuario suspendido o inexistente); mass assignment; salida negativa como escalada a entrada; límites y tipos de cantidad; referencias a otra organización; doble confirmación concurrente; payload > 500 líneas, > límite del parser, JSON malformado, prototype pollution, `<script>` en nota; 500 genérico con rollback |
| RF-16 Entrada | `rf-16-security-inbound.test.ts` | claim de rol falsificado ignorado; degradación de rol inmediata; OPERATOR no confirma ni muta (PATCH tipo/estado/bodega) borradores; entrada a bodega ajena; lectura/confirmación entre organizaciones |
| RF-17 Traspaso | `rf-17-security-transfer.test.ts` | origen/destino en otra organización; redirigir una mitad por línea; cantidad cero o negativa en texto; reescritura de traspaso confirmado; doble confirmación concurrente |
| RF-18 Ajuste | `rf-18-security-adjustment.test.ts` | motivo obligatorio no evadible (espacios, tabs, ausente, PATCH); motivo > 500; inyección SQL en el motivo almacenada como texto; cantidades extremas; stock nunca negativo; OPERATOR no edita ni confirma ajustes |
| RF-20 Anulación | `rf-20-security-cancel.test.ts` | IDOR entre organizaciones; 404 indistinguible (sin enumeración); manipulación del id; doble anulación concurrente; credenciales inválidas; claim de rol falsificado; body inválido o con campos extra; motivo solo espacios; rollback ante fallo |
| RF-21 PDF | `rf-21-security-pdf.test.ts` | PDF de otra organización; acceso sin credencial válida; token en query; path traversal / SQL / null byte / script en el id; cabeceras (`Content-Type`, `nosniff`, sin `X-Powered-By`); inyección en `Content-Disposition`; metadatos del PDF sin datos internos; errores no renderizables como HTML; 500 genérico |
| RF-22 Existencias | `rf-22-security-stock-levels.test.ts` | 401 sin rol, con rol desconocido o vacío, sin tocar el repositorio; query params no declarados (`organizationId`, `isActive`…); más de 200 `productIds`, o con SQL, traversal o comodín; productos de otra organización ausentes de la lista y de `productIds`; filas sin campos internos; `pageSize` desbordado, página negativa o repetida |
| RF-23 Filtrar | `rf-23-security-filter-stock.test.ts` | `search` con tautología, sentencia apilada, `UNION`, comentarios y comodines `LIKE` llega literal al repositorio; `search` > 120 rechazado antes del repositorio; `search` repetido o con corchetes; inyección en `categoryId`/`locationId`; bodega de otra organización indistinguible de una inexistente; categoría y nombre de otra organización sin resultados |
| RF-24 Kardex | `rf-24-security-kardex.test.ts` | `productId` con traversal, traversal codificado, SQL, null byte o basura final → 400 sin tocar catálogo ni ledger; producto de otra organización con el mismo 404 que uno inexistente; bodega ajena; params no declarados; `pageSize` desbordado; 401 |
| RF-27 Bajo mínimo | `rf-27-security-low-stock.test.ts` | `limit` desbordado, negativo, con SQL, fraccionario o repetido → 400 antes de la consulta cruda; `limit` llega como número; params no declarados; productos y bodegas de otra organización; 401 |
| RF-28 Consumo | `rf-28-security-consumption.test.ts` | OPERATOR → 403 en `consumption`, `summary` y `activity` sin ejecutar ninguna consulta; 401 en las tres; `groupBy` con SQL, nombre de columna o repetido; `limit` y `from` con SQL; `organizationId` no declarado; rango invertido; solo enum, número y fechas llegan a la consulta cruda; salidas de otra organización fuera del reporte |

## Ejecutar

Desde la raíz de `beverage-ledger-api`:

```bash
pnpm test:security
pnpm vitest run test/security/rf-20-security-cancel.test.ts
```

`pnpm test` también la incluye.

## Hallazgos

Dos pruebas fallan a propósito porque detectan defectos reales de producción. No se
debilitaron:

1. **RF-20 — motivo de anulación solo con espacios aceptado.**
   `CancelMovementDto.reason` solo exige `MinLength(4)`, y `MovementsService.cancel`
   no aplica el `trim()` que sí aplica `assertReason` a los ajustes. `"        "`
   anula un movimiento confirmado y revierte stock sin justificación en la auditoría.
2. **RF-15 — body por encima del límite del parser responde 500 en vez de 413.**
   `PayloadTooLargeError` de body-parser no es `HttpException`, así que
   `AllExceptionsFilter` lo trata como error interno y lo registra con stack. No filtra
   datos (el mensaje es genérico), pero cualquiera puede provocar 500 y logs de nivel
   error a voluntad.

Observaciones sin prueba en rojo (sin impacto de seguridad explotable):

- `quantity` usa `@Type(() => Number)`, así que `true` se convierte en `1` y `"5"` en `5`.
  Los límites y la regla de signo se aplican después de la conversión (cubierto por
  pruebas), por lo que no permite saltarse controles.
- `__proto__` y `constructor` en el body se descartan en silencio (class-transformer) en
  vez de responder 400; `Object.prototype` no se contamina.
- Los errores de `GET /movements/:id/pdf` salen con `Content-Type: application/pdf`
  (ya documentado en `test/api/README.md`). Con `nosniff` y sin `text/html` no son
  ejecutables por el navegador.
