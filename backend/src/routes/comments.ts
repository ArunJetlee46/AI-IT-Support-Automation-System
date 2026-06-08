import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateUUID } from '../utils/constants';
import { sanitizeInput } from '../utils/errors';

const router = Router({ mergeParams: true });

// POST /api/tickets/:id/comments - Add comment
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comment_text, is_internal } = req.body;

    if (!comment_text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (comment_text.length < 1 || comment_text.length > 5000) {
      return res.status(400).json({ error: 'Comment must be between 1 and 5000 characters' });
    }

    // Check if ticket exists
    const ticketResult = await pool.query('SELECT id, user_id FROM tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    // Check access: external users can only comment on their own tickets
    if (req.user?.user_type === 'external' && ticket.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Internal comments only allowed for internal users
    if (is_internal && req.user?.user_type !== 'internal') {
      return res.status(403).json({ error: 'Only internal users can create internal comments' });
    }

    const commentId = generateUUID();

    const result = await pool.query(
      `INSERT INTO ticket_comments (id, ticket_id, user_id, comment_text, is_internal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ticket_id, user_id, comment_text, is_internal, created_at`,
      [commentId, id, req.user?.id, sanitizeInput(comment_text), is_internal || false]
    );

    // TODO: Send notification emails to involved parties

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets/:id/comments - Get comments
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if ticket exists and user has access
    const ticketResult = await pool.query('SELECT id, user_id FROM tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    // Check access
    if (req.user?.user_type === 'external' && ticket.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get comments
    let query = `SELECT tc.id, tc.ticket_id, tc.user_id, tc.comment_text, tc.is_internal, tc.created_at,
                   u.name, u.email
                FROM ticket_comments tc
                JOIN users u ON tc.user_id = u.id
                WHERE tc.ticket_id = $1`;

    // External users can't see internal comments
    if (req.user?.user_type === 'external') {
      query += ` AND tc.is_internal = false`;
    }

    query += ` ORDER BY tc.created_at DESC`;

    const result = await pool.query(query, [id]);

    res.json({ comments: result.rows });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
