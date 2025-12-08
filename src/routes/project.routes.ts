import { Router } from 'express';
import { 
  getAllProjects, 
  getProjectsByWorkspace,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/project.controller.js';

const router = Router();

// Get all projects accessible by the logged-in user
router.get('/', getAllProjects);

// Get projects under a specific workspace
router.get('/:workspaceId', getProjectsByWorkspace);

// Create a new project
router.post('/', createProject);

// Update a project
router.patch('/:projectId', updateProject);

// Delete a project
router.delete('/:projectId', deleteProject);

export default router;
