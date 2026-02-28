
export { CommentQuery }    from './comment.query.js';
export { CommentMutation } from './comment.mutation.js';
export { CommentAccess }   from './comment.access.js';
export { CommentActivity } from './comment.activity.js';

export { default as commentRouter } from './comment.routes.js';

export type {
  CreateCommentInput,
  UpdateCommentInput,
} from './comment.types.js';