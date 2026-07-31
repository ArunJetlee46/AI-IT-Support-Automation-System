import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    user_type: 'internal' | 'external';
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthRequest['user'];

    if (!decoded?.id || !decoded?.email || !decoded?.role || !decoded?.user_type) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

export const internalUserMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.user_type !== 'internal') {
    return res.status(403).json({ error: 'Forbidden: Internal users only' });
  }

  next();
};
