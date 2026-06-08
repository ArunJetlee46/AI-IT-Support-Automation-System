import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export const generateTicketId = async (): Promise<string> => {
  let ticketId: string;
  let isUnique = false;

  while (!isUnique) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    ticketId = `TKT-${randomNum}`;

    const result = await pool.query('SELECT id FROM tickets WHERE id = $1', [ticketId]);
    if (result.rows.length === 0) {
      isUnique = true;
    }
  }

  return ticketId!;
};

export const generateUUID = (): string => {
  return uuidv4();
};

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
