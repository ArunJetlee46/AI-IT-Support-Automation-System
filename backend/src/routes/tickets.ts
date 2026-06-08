import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, internalUserMiddleware } from '../middleware/auth';
import { generateTicketId, Categories, Priorities, Statuses, getTimeElapsed } from '../utils/constants';
import { AppError, sanitizeInput } from '../utils/errors';

const router = Router();

// POST /api/tickets - Create a new ticket
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    if (title.length < 5 || title.length > 255) {
      return res.status(400).json({ error: 'Title must be between 5 and 255 characters' });
    }

    if (description.length < 10 || description.length > 5000) {
      return res.status(400).json({ error: 'Description must be between 10 and 5000 characters' });
    }

    const ticketId = await generateTicketId();

    const result = await pool.query(
      `INSERT INTO tickets (
        id, title, description, user_id, category, priority, status, summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [ticketId, sanitizeInput(title), sanitizeInput(description), req.user?.id, 'Other', 'Medium', 'Open', null]
    );

    const ticket = result.rows[0];

    // TODO: Call AI service for categorization asynchronously

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets - List tickets with filtering
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category, priority, status, search, limit = 20, offset = 0 } = req.query;

    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    // Role-based filtering: External users only see their own tickets
    if (req.user?.user_type === 'external') {
      query += ` AND user_id = $${paramCount}`;
      params.push(req.user.id);
      paramCount++;
    }

    // Optional filters
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (priority) {
      query += ` AND priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      const searchTerm = `%${sanitizeInput(search as string)}%`;
      params.push(searchTerm);
      paramCount++;
    }

    // Get total count
    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as count'),
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(Math.min(Number(limit) || 20, 50)); // Max 50 per page
    params.push(Number(offset) || 0);

    const result = await pool.query(query, params);

    res.json({
      tickets: result.rows,
      total,
      limit: Math.min(Number(limit) || 20, 50),
      offset: Number(offset) || 0,
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets/:id - Get single ticket with comments
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    // Check access: external users can only see their own tickets
    if (req.user?.user_type === 'external' && ticket.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get comments
    const commentsResult = await pool.query(
      `SELECT tc.*, u.name, u.email FROM ticket_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = $1
       ORDER BY tc.created_at DESC`,
      [id]
    );

    // Filter internal comments for external users
    let comments = commentsResult.rows;
    if (req.user?.user_type === 'external') {
      comments = comments.filter((c) => !c.is_internal);
    }

    // Get status history
    const historyResult = await pool.query(
      `SELECT tsh.*, u.name FROM ticket_status_history tsh
       JOIN users u ON tsh.changed_by = u.id
       WHERE tsh.ticket_id = $1
       ORDER BY tsh.changed_at DESC`,
      [id]
    );

    res.json({
      ticket,
      comments,
      history: historyResult.rows,
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id - Update ticket
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, category, priority } = req.body;

    // Only internal users can update tickets
    if (req.user?.user_type === 'external') {
      return res.status(403).json({ error: 'Forbidden: Only internal users can update tickets' });
    }

    const getTicket = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (getTicket.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = getTicket.rows[0];

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      if (!Statuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;

      // Record status change
      if (status !== ticket.status) {
        await pool.query(
          `INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [id, ticket.status, status, req.user?.id]
        );

        // Update resolved_at if status is 'Resolved' or 'Closed'
        if (['Resolved', 'Closed'].includes(status)) {
          updates.push(`resolved_at = $${paramCount}`);
          params.push(new Date());
          paramCount++;
        }
      }
    }

    if (assigned_to) {
      updates.push(`assigned_to = $${paramCount}`);
      params.push(assigned_to);
      paramCount++;
    }

    if (category) {
      if (!Categories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      updates.push(`category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }

    if (priority) {
      if (!Priorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = $${paramCount}`);
    params.push(new Date());
    paramCount++;

    params.push(id);

    const result = await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    // TODO: Send notification email

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tickets/:id - Delete ticket
router.delete('/:id', authMiddleware, internalUserMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ message: 'Ticket deleted successfully', id });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
