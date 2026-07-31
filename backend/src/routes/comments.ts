import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateUUID } from '../utils/constants';
import { sanitizeInput } from '../utils/errors';
import { notifyTicketCommentAdded } from '../services/emailService';

const router = Router({ mergeParams: true });

// POST /api/tickets/:id/comments - Add comment
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const commentText = sanitizeInput(String(req.body.comment_text || ''));
    const isInternal = Boolean(req.body.is_internal);

    if (!commentText) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (commentText.length < 1 || commentText.length > 5000) {
      return res.status(400).json({ error: 'Comment must be between 1 and 5000 characters' });
    }

    const ticketResult = await pool.query(
      `SELECT t.id, t.user_id, t.assigned_to, t.title,
              owner.name as owner_name, owner.email as owner_email,
              assignee.name as assignee_name, assignee.email as assignee_email
       FROM tickets t
       JOIN users owner ON owner.id = t.user_id
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       WHERE t.id = $1`,
      [id]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    if (req.user?.user_type === 'external' && ticket.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (isInternal && req.user?.user_type !== 'internal') {
      return res.status(403).json({ error: 'Only internal users can create internal comments' });
    }

    const commentId = generateUUID();

    const result = await pool.query(
      `INSERT INTO ticket_comments (id, ticket_id, user_id, comment_text, is_internal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ticket_id, user_id, comment_text, is_internal, created_at`,
      [commentId, id, req.user?.id, commentText, isInternal]
    );

    const recipients = new Map<string, { email: string; name?: string }>();

    if (!isInternal && ticket.owner_email && ticket.user_id !== req.user?.id) {
      recipients.set(ticket.owner_email, { email: ticket.owner_email, name: ticket.owner_name });
    }

    if (ticket.assignee_email && ticket.assigned_to !== req.user?.id) {
      recipients.set(ticket.assignee_email, { email: ticket.assignee_email, name: ticket.assignee_name });
    }

    await Promise.allSettled(
      Array.from(recipients.values()).map((recipient) =>
        notifyTicketCommentAdded({
          to: recipient.email,
          name: recipient.name,
          ticketId: id,
          title: ticket.title,
          message: commentText,
        })
      )
    );

    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets/:id/comments - Get comments
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ticketResult = await pool.query('SELECT id, user_id FROM tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    if (req.user?.user_type === 'external' && ticket.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let query = `SELECT tc.id, tc.ticket_id, tc.user_id, tc.comment_text, tc.is_internal, tc.created_at,
                    u.name, u.email
                 FROM ticket_comments tc
                 JOIN users u ON tc.user_id = u.id
                 WHERE tc.ticket_id = $1`;

    if (req.user?.user_type === 'external') {
      query += ' AND tc.is_internal = false';
    }

    query += ' ORDER BY tc.created_at DESC';

    const result = await pool.query(query, [id]);

    res.json({ comments: result.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
