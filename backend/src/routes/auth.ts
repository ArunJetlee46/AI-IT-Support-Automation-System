import { Router, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../config/database';
import { AuthRequest, authMiddleware, internalUserMiddleware } from '../middleware/auth';
import { validateEmail, validatePassword, sanitizeInput } from '../utils/errors';
import { generateUUID } from '../utils/constants';

dotenv.config();

const router = Router();
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiration = process.env.JWT_EXPIRATION || '24h';

const signToken = (user: { id: string; email: string; role: string; user_type: 'internal' | 'external' }) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(user, jwtSecret, { expiresIn: jwtExpiration });
};

// POST /api/auth/register
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const email = sanitizeInput(String(req.body.email || '')).toLowerCase();
    const password = String(req.body.password || '');
    const name = sanitizeInput(String(req.body.name || ''));
    const user_type = req.body.user_type as 'internal' | 'external';

    if (!email || !password || !name || !user_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and numbers' });
    }

    if (!['internal', 'external'].includes(user_type)) {
      return res.status(400).json({ error: 'Invalid user_type' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const userId = generateUUID();

    const result = await pool.query(
      `INSERT INTO users (id, email, password, name, user_type, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, name, role, user_type`,
      [userId, email, hashedPassword, name, user_type, user_type === 'internal' ? 'agent' : 'user']
    );

    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({ user_id: user.id, token, user });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const email = sanitizeInput(String(req.body.email || '')).toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      user_type: user.user_type,
    });

    res.json({
      user_id: user.id,
      token,
      role: user.role,
      user_type: user.user_type,
      name: user.name,
      email: user.email,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, user_type, phone, department, created_at, updated_at FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/internal-users
router.get('/internal-users', authMiddleware, internalUserMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE user_type = 'internal' AND is_active = true
       ORDER BY name ASC`
    );

    res.json({ users: result.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
