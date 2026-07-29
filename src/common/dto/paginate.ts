import type { PageDto } from './pagination.dto';

/**
 * Turns the `limit + 1` rows a repository fetches into a page.
 *
 * The extra row is never returned: its only job is to answer whether another
 * page exists without a second COUNT query.
 *
 * The cursor is the row's `id` unless the caller says otherwise, which stock
 * does — its rows are keyed by product.
 */
export function toPage<T extends { id: string }>(rows: T[], limit: number): PageDto<T>;
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): PageDto<T>;
export function toPage<T>(rows: T[], limit: number, cursorOf?: (row: T) => string): PageDto<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  const readCursor = cursorOf ?? ((row: T) => (row as { id: string }).id);

  return {
    data,
    meta: {
      nextCursor: hasMore && last !== undefined ? readCursor(last) : null,
      hasMore,
      count: data.length,
    },
  };
}
