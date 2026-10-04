# Pruebas de seguridad — movimientos de inventario

Suite de **security testing** para RF-15, RF-16, RF-17, RF-18, RF-20 y RF-21 de
Beverage Ledger API. No repite los casos funcionales de `api-testing/` ni de
`regression-testing/`: verifica riesgos de seguridad sobre la implementación real
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

A diferencia de `api-testing/` (que reemplaza repositorios y el guard JWT), aquí solo
se reemplaza el cliente Prisma. El fake aplica **exactamente** el `where` que recibe:
si un repositorio olvidara `organizationId`, devolvería filas del otro tenant y las
pruebas de aislamiento fallarían (comprobado mutando el fake: fallan las 9).

Las transacciones del fake se serializan y hacen *rollback* ante error, como
PostgreSQL, para que las aserciones de "no cambió nada" tengan sentido.

## Alcance

| RF | Archivo | Riesgos verificados |
|---|---|---|
| RF-15 Salida | `tests/rf-15-security-outbound.test.ts` | autenticación (sin token, firma ajena, expirado, `alg:none`, payload alterado, esquema incorrecto, token en query/cookie, usuario suspendido o inexistente); mass assignment; salida negativa como escalada a entrada; límites y tipos de cantidad; referencias a otra organización; doble confirmación concurrente; payload > 500 líneas, > límite del parser, JSON malformado, prototype pollution, `<script>` en nota; 500 genérico con rollback |
| RF-16 Entrada | `tests/rf-16-security-inbound.test.ts` | claim de rol falsificado ignorado; degradación de rol inmediata; OPERATOR no confirma ni muta (PATCH tipo/estado/bodega) borradores; entrada a bodega ajena; lectura/confirmación entre organizaciones |
| RF-17 Traspaso | `tests/rf-17-security-transfer.test.ts` | origen/destino en otra organización; redirigir una mitad por línea; cantidad cero o negativa en texto; reescritura de traspaso confirmado; doble confirmación concurrente |
| RF-18 Ajuste | `tests/rf-18-security-adjustment.test.ts` | motivo obligatorio no evadible (espacios, tabs, ausente, PATCH); motivo > 500; inyección SQL en el motivo almacenada como texto; cantidades extremas; stock nunca negativo; OPERATOR no edita ni confirma ajustes |
| RF-20 Anulación | `tests/rf-20-security-cancel.test.ts` | IDOR entre organizaciones; 404 indistinguible (sin enumeración); manipulación del id; doble anulación concurrente; credenciales inválidas; claim de rol falsificado; body inválido o con campos extra; motivo solo espacios; rollback ante fallo |
| RF-21 PDF | `tests/rf-21-security-pdf.test.ts` | PDF de otra organización; acceso sin credencial válida; token en query; path traversal / SQL / null byte / script en el id; cabeceras (`Content-Type`, `nosniff`, sin `X-Powered-By`); inyección en `Content-Disposition`; metadatos del PDF sin datos internos; errores no renderizables como HTML; 500 genérico |

## Ejecutar

Desde la raíz de `beverage-ledger-api`:

```bash
pnpm test:security          # o: npm test -- security-testing
pnpm vitest run security-testing/tests/rf-20-security-cancel.test.ts
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
  (ya documentado en `api-testing/README.md`). Con `nosniff` y sin `text/html` no son
  ejecutables por el navegador.
