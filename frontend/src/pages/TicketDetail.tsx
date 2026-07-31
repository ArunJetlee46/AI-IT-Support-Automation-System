import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { authAPI, ticketAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Ticket, TicketAttachment, TicketComment } from '../types';
import { formatDateTime, priorityBadgeClass, statusBadgeClass } from '../utils/ticketUi';

interface TicketResponse {
  ticket: Ticket;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  history: Array<{ id: string; old_status: string | null; new_status: string; changed_at: string; name: string }>;
}

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [payload, setPayload] = useState<TicketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [internalComment, setInternalComment] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [internalUsers, setInternalUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const fetchTicket = async () => {
    if (!id) return;

    setLoading(true);
    setError('');
    try {
      const { data } = await ticketAPI.getTicket(id);
      setPayload(data);
      setStatusUpdate(data.ticket.status);
      setAssignedTo(data.ticket.assigned_to || '');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  useEffect(() => {
    const loadInternalUsers = async () => {
      if (user?.user_type !== 'internal') return;
      try {
        const { data } = await authAPI.getInternalUsers();
        setInternalUsers(data.users || []);
      } catch {
        setInternalUsers([]);
      }
    };

    loadInternalUsers();
  }, [user?.user_type]);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || !commentText.trim()) return;

    try {
      await ticketAPI.addComment(id, {
        comment_text: commentText,
        is_internal: user?.user_type === 'internal' ? internalComment : false,
      });
      setCommentText('');
      setInternalComment(false);
      await fetchTicket();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add comment');
    }
  };

  const updateStatus = async () => {
    if (!id || !payload || user?.user_type !== 'internal') return;

    try {
      await ticketAPI.updateTicket(id, { status: statusUpdate });
      await fetchTicket();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const updateAssignment = async () => {
    if (!id || user?.user_type !== 'internal') return;

    try {
      await ticketAPI.updateTicket(id, { assigned_to: assignedTo || null });
      await fetchTicket();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update assignee');
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading ticket...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!payload) {
    return <div className="p-8 text-gray-500">Ticket not found.</div>;
  }

  const { ticket, comments, attachments, history } = payload;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-3">
            <div className="flex flex-wrap gap-2 justify-between">
              <h1 className="text-xl font-bold text-gray-900">{ticket.id} • {ticket.title}</h1>
              <div className="flex gap-2">
                <span className={`badge ${priorityBadgeClass[ticket.priority]}`}>{ticket.priority}</span>
                <span className={`badge ${statusBadgeClass[ticket.status]}`}>{ticket.status}</span>
              </div>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            <p className="text-sm text-gray-500">Category: {ticket.category}</p>
            {ticket.summary && <p className="text-sm text-gray-600">AI Summary: {ticket.summary}</p>}
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Comments</h2>
            <form onSubmit={submitComment} className="space-y-3 mb-4">
              <textarea
                className="input min-h-24"
                placeholder="Add a comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={5000}
                required
              />
              {user?.user_type === 'internal' && (
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={internalComment}
                    onChange={(event) => setInternalComment(event.target.checked)}
                  />
                  Internal note (IT staff only)
                </label>
              )}
              <button className="btn-primary" type="submit">Post Comment</button>
            </form>

            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="p-3 rounded-lg border border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{comment.name} ({comment.email})</span>
                    <span>{formatDateTime(comment.created_at)}</span>
                  </div>
                  {comment.is_internal && <span className="badge badge-warning mb-2">Internal</span>}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Status History</h2>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="text-sm text-gray-700">
                  <p>
                    {item.old_status || 'Created'} → <span className="font-medium">{item.new_status}</span>
                  </p>
                  <p className="text-xs text-gray-500">{item.name} • {formatDateTime(item.changed_at)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Attachments</h2>
            <ul className="space-y-2 text-sm">
              {attachments.map((file) => (
                <li key={file.id} className="border border-gray-200 rounded-lg p-2">
                  <p className="font-medium text-gray-800">{file.filename}</p>
                  <p className="text-xs text-gray-500">{Math.round(file.file_size / 1024)} KB</p>
                </li>
              ))}
              {attachments.length === 0 && <li className="text-gray-500">No attachments.</li>}
            </ul>
          </div>

          {user?.user_type === 'internal' && (
            <div className="card space-y-3">
              <h2 className="font-semibold text-gray-900">Update Status</h2>
              <select className="input" value={statusUpdate} onChange={(event) => setStatusUpdate(event.target.value)}>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
              <button className="btn-primary" onClick={updateStatus}>Save</button>
            </div>
          )}

          {user?.user_type === 'internal' && (
            <div className="card space-y-3">
              <h2 className="font-semibold text-gray-900">Assign Ticket</h2>
              <select className="input" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Unassigned</option>
                {internalUsers.map((internalUser) => (
                  <option key={internalUser.id} value={internalUser.id}>
                    {internalUser.name} ({internalUser.email})
                  </option>
                ))}
              </select>
              <button className="btn-primary" onClick={updateAssignment}>Save Assignee</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;
