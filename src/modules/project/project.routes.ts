
import { Router } from 'express';
import {
  getUserProjects,
  getProjectsByWorkspace,
  getProjectDetails,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from './project.controller.js';

const router = Router();

router.get('/user/all',                 getUserProjects);
router.get('/workspace/:workspaceId',   getProjectsByWorkspace);

router.post('/',                        createProject);
router.get('/:projectId',               getProjectDetails);
router.patch('/:projectId',             updateProject);
router.delete('/:projectId',            deleteProject);

router.post('/:projectId/members',                      addProjectMember);
router.patch('/:projectId/members/:memberId',            updateProjectMemberRole);
router.delete('/:projectId/members/:memberId',           removeProjectMember);

export default router;