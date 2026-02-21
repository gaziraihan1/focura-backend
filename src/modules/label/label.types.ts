/**
 * label.types.ts
 * Responsibility: All types, interfaces, and domain error classes for the Label domain.
 *
 * Error classes live here (not in a separate errors.ts) because they are
 * Label-domain-specific. If you later build a shared error base across all
 * modules, move them to shared/errors.ts and re-export from here.
 */

// ─── Domain error hierarchy ───────────────────────────────────────────────────

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

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateLabelDto {
  name: string;
  color: string;
  description?: string;
  workspaceId?: string;
  createdById: string;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string;
  description?: string | null;
}

// ─── Filter shapes ─────────────────────────────────────────────────────────────

export interface LabelFilters {
  workspaceId?: string;
}

export interface PopularLabelsFilters {
  workspaceId?: string;
  limit?: number;
}