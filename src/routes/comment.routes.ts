import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { addComment, deleteComment, getComments, updateComment } from '../controllers/comment.controller.js';

const router = Router({ mergeParams: true }); 

router.use(authenticate);

router.get('/', getComments);             
router.post('/', addComment);               
router.delete('/:commentId', deleteComment); 
// routes/comment.routes.ts
router.put('/:commentId', updateComment); 


export default router;
