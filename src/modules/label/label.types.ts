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

export interface LabelFilters {
  workspaceId?: string;
}

export interface PopularLabelsFilters {
  workspaceId?: string;
  limit?: number;
}