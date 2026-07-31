import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ticketAPI } from '../api/client';

const CreateTicket: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      if (category) {
        formData.append('category', category);
      }

      if (files) {
        Array.from(files).forEach((file) => formData.append('attachments', file));
      }

      const { data } = await ticketAPI.createTicket(formData);
      navigate(`/tickets/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto card space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Support Ticket</h1>
          <p className="text-gray-600 text-sm">Describe your issue and attach supporting files.</p>
        </div>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={5}
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              className="input min-h-40"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              minLength={10}
              maxLength={5000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category (optional)</label>
            <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Auto-categorize with AI</option>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (optional)</label>
            <input
              type="file"
              className="input"
              onChange={(event) => setFiles(event.target.files)}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.zip"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum 5 files, 10MB each.</p>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary" onClick={() => navigate('/tickets')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;
