/**
 * upload.routes.ts
 * Responsibility: File upload route definitions.
 */

import { Router } from 'express';
// import { authenticate } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { uploadFile } from './upload.controller.js';

const router = Router();

// File upload (requires authentication + multer middleware)
router.post('/', upload.single('file'), uploadFile);

export default router;