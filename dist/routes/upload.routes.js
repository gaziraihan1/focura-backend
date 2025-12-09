// routes/upload.routes.ts
import { Router } from 'express';
import { uploadFile } from '../controllers/upload.controller.js';
// import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
const router = Router();
router.post('/', upload.single('file'), uploadFile);
export default router;
//# sourceMappingURL=upload.routes.js.map