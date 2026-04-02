export interface AdminStats {
  totals: {
    users:      number;
    workspaces: number;
    projects:   number;
    tasks:      number;
    announcements: number;
  };
  plans: {
    plan:  string;
    count: number;
  }[];
  featureRequests: {
    pending:   number;
    approved:  number;
    planned:   number;
    completed: number;
    rejected:  number;
  };
  recentSignups: {
    id:        string;
    name:      string;
    email:     string;
    image:     string | null;
    createdAt: Date;
  }[];
  recentWorkspaces: {
    id:        string;
    name:      string;
    plan:      string;
    createdAt: Date;
    owner: { id: string; name: string; email: string };
    _count: { members: number; projects: number };
  }[];
}

export interface AdminWorkspace {
  id:        string;
  name:      string;
  slug:      string;
  plan:      string;
  createdAt: Date;
  owner: {
    id:    string;
    name:  string;
    email: string;
    image: string | null;
  };
  _count: {
    members:  number;
    projects: number;
    tasks:    number;
  };
}

export interface AdminWorkspaceDetail {
  id:          string;
  name:        string;
  slug:        string;
  plan:        string;
  createdAt:   Date;
  updatedAt:   Date;
  owner: {
    id:    string;
    name:  string;
    email: string;
    image: string | null;
  };
  members: {
    id:       string;
    role:     string;
    joinedAt: Date;
    user: {
      id:    string;
      name:  string;
      email: string;
      image: string | null;
    };
  }[];
  projects: {
    id:        string;
    name:      string;
    slug:      string;
    status:    string;
    priority:  string;
    createdAt: Date;
    _count: { tasks: number; members: number };
  }[];
  _count: {
    members:  number;
    projects: number;
  };
}

export interface AdminUser {
  id:        string;
  name:      string;
  email:     string;
  image:     string | null;
  role:      string;
  createdAt: Date;
  _count: {
    workspaces:       number; // owned
    workspaceMember:  number; // member of
  };
}

export interface AdminProject {
  id:        string;
  name:      string;
  slug:      string;
  status:    string;
  priority:  string;
  createdAt: Date;
  workspace: {
    id:   string;
    name: string;
    slug: string;
  };
  createdBy: {
    id:    string;
    name:  string;
    email: string;
  };
  _count: {
    tasks:   number;
    members: number;
  };
}

export interface AdminActivity {
  id:         string;
  action:     string;
  entityType: string;
  entityId:   string;
  createdAt:  Date;
  user: {
    id:    string;
    name:  string;
    email: string;
    image: string | null;
  };
  workspace: {
    id:   string;
    name: string;
  } | null;
  metadata: any;
}

export interface AdminPaginationParams {
  page?:     number;
  pageSize?: number;
  search?:   string;
}

export interface PaginatedAdminResult<T> {
  data: T[];
  pagination: {
    page:       number;
    pageSize:   number;
    totalCount: number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}