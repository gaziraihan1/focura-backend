import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const getAllProjects: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createProject: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateProject: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteProject: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getProjectsByWorkspace: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
