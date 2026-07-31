import type { PageDto, PagePaginationDto } from './pagination.dto';

/** Rows a 1-based page has to step over, so no caller works out an offset. */
export const skipOf = (query: PagePaginationDto): number => (query.page - 1) * query.pageSize;

/**
 * Pairs one page of rows with the count of everything that matched.
 *
 * The count has to come from the same `where` as the rows or the pager lies
 * about how many pages there are, which is why every repository issues both
 * together instead of exposing a counter a caller could let drift.
 */
export function toPage<T>(rows: T[], total: number, query: PagePaginationDto): PageDto<T> {
  return {
    data: rows,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      // An empty list is still one page: a pager with zero pages has nothing to
      // render, and "page 1 of 0" reads like a bug.
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      count: rows.length,
    },
  };
}
