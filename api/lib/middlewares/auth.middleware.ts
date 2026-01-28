import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: { userId: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers['x-auth-token'];

  if (!header || typeof header !== 'string') {
    return res.status(401).json({ error: 'Brak tokena' });
  }

  const token = header.startsWith('Bearer ') ? header.substring(7) : header;

  try {
    const payload = jwt.verify(token, String(config.jwtSecret)) as any;
    req.user = { userId: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: 'Nieprawidłowy lub wygasły token' });
  }
}
