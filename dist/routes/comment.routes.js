import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { addComment, deleteComment, getComments, updateComment } from '../controllers/comment.controller.js';
const router = Router({ mergeParams: true }); // mergeParams to get taskId from parent route
router.use(authenticate); // all routes require auth
router.get('/', getComments); // GET /api/tasks/:taskId/comments
router.post('/', addComment); // POST /api/tasks/:taskId/comments
router.delete('/:commentId', deleteComment); // DELETE /api/tasks/:taskId/comments/:commentId
// routes/comment.routes.ts
router.put('/:commentId', updateComment); // PUT /api/tasks/:taskId/comments/:commentId
export default router;
//# sourceMappingURL=comment.routes.js.map