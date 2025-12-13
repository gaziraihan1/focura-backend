// routes/project.routes.ts
import { Router } from 'express';
import {
  getProjectDetails,
  getProjectsByWorkspace,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '../controllers/project.controller.js';

const router = Router();

// Project CRUD - IMPORTANT: Specific routes MUST come before parameterized routes
router.post('/', createProject);                                           // Create project
router.get('/workspace/:workspaceId', getProjectsByWorkspace);             // Get workspace projects (specific route)
router.get('/:projectId', getProjectDetails);                              // Get project details (parameterized route)
router.patch('/:projectId', updateProject);                                // Update project
router.delete('/:projectId', deleteProject);                               // Delete project

// Project Members
router.post('/:projectId/members', addProjectMember);                      // Add member
router.patch('/:projectId/members/:memberId', updateProjectMemberRole);    // Update member role
router.delete('/:projectId/members/:memberId', removeProjectMember);       // Remove member

export default router;