const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

export interface NormalizedPage {
  page:   number;
  limit:  number;
  skip:   number;
}

/**
 * Normalise raw page/limit inputs coming from query-strings or callers.
 * Always returns safe, bounded integers.
 */
export function normalizePage(
  page?:  number | string,
  limit?: number | string,
): NormalizedPage {
  const p = Math.max(1, parseInt(String(page  ?? DEFAULT_PAGE),  10) || DEFAULT_PAGE);
  const l = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );

  return { page: p, limit: l, skip: (p - 1) * l };
}

/**
 * Build the standard pagination metadata block from a total count.
 */
export function buildPaginationMeta(
  total: number,
  { page, limit }: Pick<NormalizedPage, 'page' | 'limit'>,
) {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}