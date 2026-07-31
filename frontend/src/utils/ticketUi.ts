export const priorityBadgeClass: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-blue-100 text-blue-800',
};

export const statusBadgeClass: Record<string, string> = {
  Open: 'bg-slate-100 text-slate-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  Resolved: 'bg-green-100 text-green-800',
  Closed: 'bg-gray-100 text-gray-800',
};

export const formatDateTime = (value: string) => new Date(value).toLocaleString();

export const formatRelative = (value: string) => {
  const now = Date.now();
  const date = new Date(value).getTime();
  const diffMins = Math.floor((now - date) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};
