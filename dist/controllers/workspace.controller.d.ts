import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare class WorkspaceController {
    static getAllWorkspaces(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static createWorkspace(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static getWorkspace(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static updateWorkspace(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static deleteWorkspace(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static getMembers(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static inviteMember(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static getInvitation(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static removeMember(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static updateMemberRole(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static getStats(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static acceptInvitation(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    static leaveWorkspace(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
