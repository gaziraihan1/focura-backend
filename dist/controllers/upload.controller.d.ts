import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const uploadFile: (req: AuthRequest, res: Response) => Promise<void>;
