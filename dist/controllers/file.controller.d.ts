import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const getUserFiles: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteFile: (req: AuthRequest, res: Response) => Promise<void>;
