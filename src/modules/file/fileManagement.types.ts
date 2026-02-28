
export interface FileWithDetails {
  id: string;
  name: string;
  originalName: string;
  size: number;
  sizeMB: number;
  mimeType: string;
  url: string;
  uploadedAt: Date;
  folder: string | null;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  task: {
    id: string;
    title: string;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
}

export interface FileFilters {
  search?: string;
  fileType?: string;
  uploadedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: 'name' | 'size' | 'date';
  sortOrder?: 'asc' | 'desc';
}

export interface FileListResult {
  files: FileWithDetails[];
  total: number;
  hasMore: boolean;
  isAdmin: boolean;
}

export interface FileTypeStats {
  type: string;
  count: number;
  sizeMB: number;
}

export interface UploaderInfo {
  id: string;
  name: string | null;
  email: string;
  fileCount: number;
}

export const FILE_TYPE_MAP: Record<string, string[]> = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  videos: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
};