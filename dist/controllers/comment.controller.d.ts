import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const getComments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const addComment: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteComment: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateComment: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
