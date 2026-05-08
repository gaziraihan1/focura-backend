export interface CreateSubtaskInput {
  title:           string;
  description?:    string;
  status?:         string;
  priority?:       string;
  dueDate?:        Date;
  estimatedHours?: number;
  assigneeIds?:    string[];
  parentId:        string;
  createdById:     string;
}

export interface UpdateSubtaskInput {
  title?:          string;
  description?:    string;
  status?:         string;
  priority?:       string;
  dueDate?:        Date | null;
  estimatedHours?: number;
}

export interface EditSubtaskPermissionResult {
  canEdit: boolean;
  reason?: string;
}