// ─── Error classes ────────────────────────────────────────────────────────────

export class LabelError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'LabelError';
  }
}

export class UnauthorizedError extends LabelError {
  constructor(message = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends LabelError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends LabelError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends LabelError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateLabelDto {
  name:         string;
  color:        string;
  description?: string;
  workspaceId?: string;
  createdById:  string;
}

export interface UpdateLabelDto {
  name?:        string;
  color?:       string;
  description?: string | null;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?:  number; // 1-based, default 1
  limit?: number; // default 20, max 100
}

export interface PaginationMeta {
  page:        number;
  limit:       number;
  total:       number;
  totalPages:  number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data:       T[];
  pagination: PaginationMeta;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface LabelFilters extends PaginationParams {
  workspaceId?: string;
}

export interface PopularLabelsFilters extends PaginationParams {
  workspaceId?: string;
  /** Kept for backward-compat — maps to `limit` in PaginationParams. */
  limit?: number;
}

export interface LabelTasksFilters extends PaginationParams {
  status?:   'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
}