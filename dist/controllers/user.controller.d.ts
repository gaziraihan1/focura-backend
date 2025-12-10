import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const getUserProfile: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateUserProfile: (req: AuthRequest, res: Response) => Promise<void>;
