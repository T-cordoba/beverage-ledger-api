# Pruebas de rendimiento — movimientos, existencias y reportes

Esta suite mide, de forma repetible, el desempeño de los RF de movimientos de
Beverage Ledger API. Sigue la idea del ejemplo `performance-testing` del curso
(`perf_counter`, `timeit.repeat` y mediana contra un presupuesto amplio), adaptada
al stack real del proyecto: **NestJS + Vitest + Chai**.

No es una prueba de carga: usa volúmenes pequeños y controlados.

## Infraestructura

Reutiliza, sin modificarla, la de `test/api/support`: la API se levanta en
memoria en un puerto efímero con los controladores, pipes, guards, filtro y
servicios reales; solo los repositorios Prisma se sustituyen por el ledger en
memoria. Por eso **se mide la capa de aplicación** (validación, reglas de negocio,
serialización HTTP y generación del PDF), no la latencia de PostgreSQL.

`support/perf-metrics.ts` concentra la medición (calentamiento, muestras,
media, mediana, p95, máximo), los volúmenes y todos los presupuestos.

## Alcance

| RF | Archivo | Qué se mide |
|---|---|---|
| RF-15 Salida (OUTBOUND) | `rf-15-perf-outbound.test.ts` | `POST /movements`; crear + confirmar; ráfaga concurrente |
| RF-16 Entrada (INBOUND) | `rf-16-perf-inbound.test.ts` | ídem, con conversión de cajas a botellas |
| RF-17 Traspaso (TRANSFER) | `rf-17-perf-transfer.test.ts` | ídem, verificando origen y destino |
| RF-18 Ajuste (ADJUSTMENT) | `rf-18-perf-adjustment.test.ts` | ídem; ráfaga con ajustes +1/−1 |
| RF-19 Borrador | `rf-19-perf-draft.test.ts` | buscar el borrador abierto entre 2000 movimientos; `PATCH` de un borrador de 200 líneas; ráfaga de búsquedas |
| RF-20 Anulación | `rf-20-perf-cancel.test.ts` | `POST /movements/:id/cancel`; ráfaga sobre movimientos distintos y sobre el mismo |
| RF-21 Comprobante PDF | `rf-21-perf-pdf.test.ts` | `GET /movements/:id/pdf`; `MovementPdfService.render` con 1 y 150 líneas; descargas concurrentes |
| RF-22 Existencias | `rf-22-perf-stock-levels.test.ts` | `GET /stock` en páginas de 100 sobre 1000 productos; recorrido completo sin repetidos; ráfaga concurrente |
| RF-23 Filtrar existencias | `rf-23-perf-filter-stock.test.ts` | `search`, `categoryId`, ambos y `locationId` sobre 1000 productos, verificando el `total` |
| RF-24 Kardex | `rf-24-perf-kardex.test.ts` | página más reciente y más antigua de un kardex de 2000 líneas con su saldo; ráfaga concurrente |
| RF-27 Bajo mínimo | `rf-27-perf-low-stock.test.ts` | `GET /stock/low?limit=100` sobre 1000 productos, ordenado por urgencia; ráfaga concurrente |
| RF-28 Consumo | `rf-28-perf-consumption.test.ts` | `GET /reports/consumption?limit=200` por producto, categoría y marca, y `/reports/summary`, sobre 2000 salidas; ráfaga concurrente |

Cada prueba de rendimiento también comprueba que la operación fue correcta
(código HTTP, existencias, firma `%PDF-`), para que un resultado rápido pero
erróneo no pase.

## Volúmenes y presupuestos

- 3 ejecuciones de calentamiento no medidas (JIT, carga perezosa, fuentes del PDF).
- 30 ejecuciones medidas por operación HTTP; 20 para PDF.
- Ráfagas de 20 solicitudes concurrentes (10 para PDF).
- Semilla de lectura: 1000 productos activos, 2000 líneas de kardex y 2000 salidas
  confirmadas para los reportes, sembradas directo en el ledger en memoria.

| Operación | Mediana | Máximo |
|---|---|---|
| Una solicitud (crear borrador, anular) | < 50 ms | < 250 ms |
| Registrar (crear + confirmar) | < 100 ms | < 500 ms |
| Descargar PDF por HTTP | < 150 ms | < 750 ms |
| Generar PDF de 1 línea | < 100 ms | < 500 ms |
| Generar PDF de 150 líneas (varias páginas) | < 500 ms | < 2000 ms |
| Una lectura sobre la semilla grande (página de existencias, kardex, bajo mínimo, reporte) | < 50 ms | < 250 ms |
| `PATCH` de un borrador de 200 líneas | < 100 ms | < 500 ms |
| Ráfaga de 20 registros / 20 anulaciones / 10 PDF / 20 lecturas (total) | < 2000 / 1500 / 3000 / 1500 ms | — |

Localmente las medianas están entre ~3 y ~10 ms (≈45 ms el PDF de 150 líneas):
los presupuestos dejan ~10× de margen para agentes de CI más lentos y se juzgan
sobre la mediana, que un pico aislado (GC, vecino ruidoso) no mueve. El máximo
solo atrapa bloqueos reales.

## Ejecutar

```bash
pnpm test:performance
```

Con el detalle de cada medición (`[perf] ... median=... max=...`):

```bash
pnpm vitest run test/performance --reporter=verbose
```
