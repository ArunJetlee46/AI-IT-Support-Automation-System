import path from 'path';
import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, internalUserMiddleware } from '../middleware/auth';
import { uploadAttachments } from '../middleware/upload';
import { generateTicketId, generateUUID, Categories, Priorities, Statuses } from '../utils/constants';
import { sanitizeInput, validateEmail } from '../utils/errors';
import { categorizeTicketWithAI } from '../services/aiCategorization';
import {
  notifyITTeamOnNewTicket,
  notifyTicketAssigned,
  notifyTicketCreated,
  notifyTicketStatusChanged,
} from '../services/emailService';

const router = Router();

interface TicketCreateRequest extends AuthRequest {
  files?: Express.Multer.File[];
}

const priorityOrderSql = `
  CASE
    WHEN priority = 'Critical' THEN 1
    WHEN priority = 'High' THEN 2
    WHEN priority = 'Medium' THEN 3
    WHEN priority = 'Low' THEN 4
    ELSE 5
  END
`;

// POST /api/tickets - Create a new ticket
router.post('/', authMiddleware, uploadAttachments.array('attachments', 5), async (req: TicketCreateRequest, res: Response) => {
  try {
    const title = sanitizeInput(String(req.body.title || ''));
    const description = sanitizeInput(String(req.body.description || ''));
    const selectedCategory = req.body.category ? sanitizeInput(String(req.body.category)) : undefined;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    if (title.length < 5 || title.length > 255) {
      return res.status(400).json({ error: 'Title must be between 5 and 255 characters' });
    }

    if (description.length < 10 || description.length > 5000) {
      return res.status(400).json({ error: 'Description must be between 10 and 5000 characters' });
    }

    if (selectedCategory && !Categories.includes(selectedCategory)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const aiResult = await categorizeTicketWithAI(title, description);
    const finalCategory = selectedCategory || aiResult.category;

    const ticketId = await generateTicketId();

    const result = await pool.query(
      `INSERT INTO tickets (
        id, title, description, user_id, category, priority, status, summary, ai_categorization_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        ticketId,
        title,
        description,
        req.user?.id,
        finalCategory,
        aiResult.priority,
        'Open',
        aiResult.summary,
        aiResult.confidence,
      ]
    );

    await pool.query(
      `INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [generateUUID(), ticketId, null, 'Open', req.user?.id]
    );

    const files = req.files || [];
    const insertedAttachments = [];

    for (const file of files) {
      const attachmentId = generateUUID();
      const relativePath = path.relative(process.cwd(), file.path);

      const attachmentResult = await pool.query(
        `INSERT INTO attachments (id, ticket_id, filename, file_size, file_path, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, ticket_id, filename, file_size, file_path, uploaded_by, created_at`,
        [attachmentId, ticketId, file.originalname, file.size, relativePath, req.user?.id]
      );

      insertedAttachments.push(attachmentResult.rows[0]);
    }

    const ticket = result.rows[0];

    const ticketOwnerResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [ticket.user_id]);
    const ticketOwner = ticketOwnerResult.rows[0];

    if (ticketOwner?.email) {
      await notifyTicketCreated({
        to: ticketOwner.email,
        name: ticketOwner.name,
        ticketId: ticket.id,
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
      });
    }

    await notifyITTeamOnNewTicket(ticket.id, ticket.title, ticket.category, ticket.priority);

    res.status(201).json({ ...ticket, attachments: insertedAttachments });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets - List tickets with filtering
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      category,
      priority,
      status,
      search,
      user,
      email,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'desc',
      limit = 20,
      offset = 0,
    } = req.query;

    let query = `
      SELECT t.*, u.name as user_name, u.email as user_email, a.name as assigned_to_name, a.email as assigned_to_email
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramCount = 1;

    if (req.user?.user_type === 'external') {
      query += ` AND t.user_id = $${paramCount}`;
      params.push(req.user.id);
      paramCount++;
    }

    if (category) {
      query += ` AND t.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount} OR COALESCE(t.summary, '') ILIKE $${paramCount})`;
      params.push(`%${sanitizeInput(String(search))}%`);
      paramCount++;
    }

    if (user && req.user?.user_type === 'internal') {
      query += ` AND t.user_id = $${paramCount}`;
      params.push(user);
      paramCount++;
    }

    if (email && req.user?.user_type === 'internal' && validateEmail(String(email))) {
      query += ` AND u.email = $${paramCount}`;
      params.push(String(email).toLowerCase());
      paramCount++;
    }

    if (date_from) {
      query += ` AND t.created_at >= $${paramCount}`;
      params.push(new Date(String(date_from)));
      paramCount++;
    }

    if (date_to) {
      query += ` AND t.created_at <= $${paramCount}`;
      params.push(new Date(String(date_to)));
      paramCount++;
    }

    const countResult = await pool.query(`SELECT COUNT(*) as count FROM (${query}) AS filtered_tickets`, params);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const normalizedSortBy = ['created_at', 'updated_at', 'priority'].includes(String(sort_by))
      ? String(sort_by)
      : 'created_at';
    const normalizedSortOrder = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (normalizedSortBy === 'priority') {
      query += ` ORDER BY ${priorityOrderSql} ${normalizedSortOrder}, t.created_at DESC`;
    } else {
      query += ` ORDER BY t.${normalizedSortBy} ${normalizedSortOrder}`;
    }

    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    const normalizedLimit = Math.min(Number(limit) || 20, 50);
    const normalizedOffset = Math.max(Number(offset) || 0, 0);
    params.push(normalizedLimit, normalizedOffset);

    const result = await pool.query(query, params);

    res.json({
      tickets: result.rows,
      total_count: totalCount,
      limit: normalizedLimit,
      offset: normalizedOffset,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets/:id - Get single ticket with comments and history
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    if (req.user?.user_type === 'external' && ticket.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const commentsResult = await pool.query(
      `SELECT tc.*, u.name, u.email FROM ticket_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = $1
       ORDER BY tc.created_at DESC`,
      [id]
    );

    const historyResult = await pool.query(
      `SELECT tsh.*, u.name FROM ticket_status_history tsh
       JOIN users u ON tsh.changed_by = u.id
       WHERE tsh.ticket_id = $1
       ORDER BY tsh.changed_at DESC`,
      [id]
    );

    const attachmentResult = await pool.query(
      `SELECT id, ticket_id, filename, file_size, file_path, uploaded_by, created_at
       FROM attachments WHERE ticket_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    const comments =
      req.user?.user_type === 'external' ? commentsResult.rows.filter((row) => !row.is_internal) : commentsResult.rows;

    res.json({
      ticket,
      comments,
      history: historyResult.rows,
      attachments: attachmentResult.rows,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id - Update ticket
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, category, priority } = req.body;

    if (req.user?.user_type === 'external') {
      return res.status(403).json({ error: 'Forbidden: Only internal users can update tickets' });
    }

    const getTicket = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (getTicket.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const existingTicket = getTicket.rows[0];

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramCount = 1;

    if (status) {
      if (!Statuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;

      if (status !== existingTicket.status) {
        await pool.query(
          `INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [generateUUID(), id, existingTicket.status, status, req.user?.id]
        );

        updates.push(`resolved_at = $${paramCount}`);
        params.push(['Resolved', 'Closed'].includes(status) ? new Date() : null);
        paramCount++;
      }
    }

    if (assigned_to !== undefined) {
      if (assigned_to !== null) {
        const assigneeCheck = await pool.query(
          `SELECT id, name, email FROM users WHERE id = $1 AND user_type = 'internal' AND is_active = true`,
          [assigned_to]
        );

        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'assigned_to must reference an active internal user' });
        }
      }

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

    const result = await pool.query(`UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, params);

    const updatedTicket = result.rows[0];

    const ownerResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [updatedTicket.user_id]);
    const owner = ownerResult.rows[0];

    if (status && status !== existingTicket.status && owner?.email) {
      await notifyTicketStatusChanged({
        to: owner.email,
        name: owner.name,
        ticketId: updatedTicket.id,
        title: updatedTicket.title,
        status: updatedTicket.status,
      });
    }

    if (assigned_to && assigned_to !== existingTicket.assigned_to) {
      const assigneeResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [assigned_to]);
      const assignee = assigneeResult.rows[0];

      if (assignee?.email) {
        await notifyTicketAssigned({
          to: assignee.email,
          name: assignee.name,
          ticketId: updatedTicket.id,
          title: updatedTicket.title,
          category: updatedTicket.category,
          priority: updatedTicket.priority,
        });
      }
    }

    res.json(updatedTicket);
  } catch {
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
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
