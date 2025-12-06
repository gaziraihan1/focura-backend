import { Router } from 'express';
import { getProjects } from '../controllers/project.controller.js';

const router = Router();

router.get('/', getProjects);

export default router;