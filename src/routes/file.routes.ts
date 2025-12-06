import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { deleteFile, getUserFiles } from '../controllers/file.controller.js';

const router = Router();

router.get('/', authenticate, getUserFiles);

router.delete('/:id', authenticate, deleteFile);

export default router;