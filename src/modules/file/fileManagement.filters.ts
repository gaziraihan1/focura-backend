
import type { FileFilters } from './fileManagement.types.js';
import { FILE_TYPE_MAP } from './fileManagement.types.js';

export function buildFileWhereClause(
  workspaceId: string,
  isAdmin: boolean,
  userId: string,
  filters?: FileFilters
) {
  const where: any = { workspaceId };

  if (!isAdmin) {
    where.uploadedById = userId;
  }

  if (filters?.search) {
    where.OR = [
      { originalName: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters?.fileType && filters.fileType !== 'all') {
    const mimeTypes = FILE_TYPE_MAP[filters.fileType];
    if (mimeTypes) {
      where.mimeType = { in: mimeTypes };
    }
  }

  if (filters?.uploadedBy && isAdmin) {
    where.uploadedById = filters.uploadedBy;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.uploadedAt = {};
    if (filters.dateFrom) where.uploadedAt.gte = filters.dateFrom;
    if (filters.dateTo) where.uploadedAt.lte = filters.dateTo;
  }

  return where;
}

export function buildFileOrderBy(filters?: FileFilters) {
  if (!filters?.sortBy) {
    return { uploadedAt: 'desc' as const };
  }

  const sortField =
    filters.sortBy === 'name'
      ? 'originalName'
      : filters.sortBy === 'size'
      ? 'size'
      : 'uploadedAt';

  return { [sortField]: filters.sortOrder || 'desc' };
}