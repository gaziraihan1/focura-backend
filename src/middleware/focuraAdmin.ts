import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { isFocuraAdmin } from '../config/admin.config.js';

export const requireFocuraAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!isFocuraAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required',
      });
    }

    next();
  } catch (error) {
    console.error('FocuraAdminMiddleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};