export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  user_type: 'internal' | 'external';
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  summary: string | null;
  user_id: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  ai_categorization_confidence: number;
  user_name?: string;
  user_email?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  comment_text: string;
  is_internal: boolean;
  created_at: string;
  name: string;
  email: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  filename: string;
  file_size: number;
  file_path: string;
  uploaded_by: string;
  created_at: string;
}
