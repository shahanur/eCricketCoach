import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: 'SUPER_ADMIN' | 'PLAYER' | 'COACH' | 'CLUB_ADMIN';
  coachContext?: 'CLUB' | 'STANDALONE';
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = decoded as AuthenticatedUser;
    next();
  });
};

export const requireRole = (allowedRoles: Array<'SUPER_ADMIN' | 'PLAYER' | 'COACH' | 'CLUB_ADMIN'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
