
export interface CreateCommentInput {
  taskId:   string;
  userId:   string;
  content:  string;
  parentId?: string | null;
}

export interface UpdateCommentInput {
  content: string;
}