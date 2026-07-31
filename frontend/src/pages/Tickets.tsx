import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Ticket } from '../types';
import { formatRelative, priorityBadgeClass, statusBadgeClass } from '../utils/ticketUi';

const Tickets: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    priority: '',
    status: '',
    search: '',
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  const fetchTickets = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await ticketAPI.getTickets({ ...filters, limit: 50 });
      setTickets(data.tickets || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filters.category, filters.priority, filters.status, filters.sort_by, filters.sort_order]);

  const filteredTickets = useMemo(() => {
    if (!filters.search) {
      return tickets;
    }

    const keyword = filters.search.toLowerCase();
    return tickets.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(keyword) ||
        ticket.description.toLowerCase().includes(keyword) ||
        (ticket.summary || '').toLowerCase().includes(keyword)
    );
  }, [tickets, filters.search]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.user_type === 'external' ? 'My Tickets' : 'All Tickets'}</h1>
            <p className="text-sm text-gray-500">Track ticket status and details</p>
          </div>
          {user?.user_type === 'external' && (
            <Link to="/create-ticket" className="btn-primary">
              Create Ticket
            </Link>
          )}
        </div>

        <div className="card grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            className="input md:col-span-2"
            placeholder="Search by keyword"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <select
            className="input"
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          >
            <option value="">All categories</option>
            <option value="Hardware Issues">Hardware Issues</option>
            <option value="Software Installation">Software Installation</option>
            <option value="Network & Connectivity">Network & Connectivity</option>
            <option value="Account & Access">Account & Access</option>
            <option value="Email & Communication">Email & Communication</option>
            <option value="Security & Compliance">Security & Compliance</option>
            <option value="Data & Backup">Data & Backup</option>
            <option value="Performance Issues">Performance Issues</option>
            <option value="Other">Other</option>
          </select>
          <select
            className="input"
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
          >
            <option value="">All priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            className="input"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <select
            className="input"
            value={`${filters.sort_by}:${filters.sort_order}`}
            onChange={(e) => {
              const [sort_by, sort_order] = e.target.value.split(':');
              setFilters((prev) => ({ ...prev, sort_by, sort_order }));
            }}
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="updated_at:desc">Recently updated</option>
            <option value="priority:asc">Highest priority</option>
          </select>
        </div>

        {loading && <p className="text-gray-500">Loading tickets...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={user?.user_type === 'internal' ? `/admin/tickets/${ticket.id}` : `/tickets/${ticket.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {ticket.id} • {ticket.title}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">{ticket.summary || 'No summary yet'}</p>
                    </td>
                    <td className="px-4 py-3">{ticket.category}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${priorityBadgeClass[ticket.priority] || 'bg-gray-100 text-gray-700'}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusBadgeClass[ticket.status] || 'bg-gray-100 text-gray-700'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatRelative(ticket.updated_at)}</td>
                  </tr>
                ))}
                {filteredTickets.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                      No tickets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tickets;
