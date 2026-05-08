export type FeatureStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PLANNED' | 'COMPLETED';
export type VoteType      = 'UP' | 'DOWN';

export interface CreateFeatureRequestInput {
  title:       string;
  description: string;
  createdById: string;
}

export interface UpdateFeatureStatusInput {
  status:     FeatureStatus;
  adminNote?: string;
}

export interface FeatureFilterParams {
  status?:   FeatureStatus;
  page?:     number;
  pageSize?: number;
  search?:   string;
}

export interface FeatureRequestResult {
  id:          string;
  title:       string;
  description: string;
  status:      FeatureStatus;
  adminNote:   string | null;
  createdAt:   Date;
  updatedAt:   Date;
  createdBy: {
    id:    string;
    name:  string;
    image: string | null;
  };
  _count: {
    upvotes:   number;
    downvotes: number;
  };
  userVote: VoteType | null; // null = not voted
}

export interface PaginatedFeatureRequestsResult {
  data: FeatureRequestResult[];
  pagination: {
    page:       number;
    pageSize:   number;
    totalCount: number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}