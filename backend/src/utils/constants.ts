import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export const generateTicketId = async (): Promise<string> => {
  const result = await pool.query(
    `SELECT id FROM tickets
     WHERE id ~ '^TKT-[0-9]+$'
     ORDER BY CAST(SUBSTRING(id FROM 5) AS INTEGER) DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return 'TKT-1001';
  }

  const latestId = result.rows[0].id as string;
  const nextNumber = Number(latestId.replace('TKT-', '')) + 1;
  return `TKT-${nextNumber}`;
};

export const generateUUID = (): string => uuidv4();

export const getTimeElapsed = (createdAt: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  return 'Just now';
};

export const Categories = [
  'Hardware Issues',
  'Software Installation',
  'Network & Connectivity',
  'Account & Access',
  'Email & Communication',
  'Security & Compliance',
  'Data & Backup',
  'Performance Issues',
  'Other',
];

export const Priorities = ['Critical', 'High', 'Medium', 'Low'];

export const Statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
