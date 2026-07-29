import type { PageDto } from './pagination.dto';

/**
 * Turns the `limit + 1` rows a repository fetches into a page.
 *
 * The extra row is never returned: its only job is to answer whether another
 * page exists without a second COUNT query.
 */
export function toPage<T extends { id: string }>(rows: T[], limit: number): PageDto<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return {
    data,
    meta: {
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
      hasMore,
      count: data.length,
    },
  };
}
