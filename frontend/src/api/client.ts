import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  register: (data: { email: string; password: string; name: string; user_type: 'internal' | 'external' }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/me'),
  getInternalUsers: () => api.get('/auth/internal-users'),
};

export const metadataAPI = {
  getCategories: () => api.get<string[]>('/categories'),
  getPriorities: () => api.get<string[]>('/priorities'),
  getStatuses: () => api.get<string[]>('/statuses'),
};

export const ticketAPI = {
  createTicket: (data: FormData) =>
    api.post('/tickets', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  getTickets: (params?: Record<string, string | number | undefined>) => api.get('/tickets', { params }),
  getTicket: (id: string) => api.get(`/tickets/${id}`),
  updateTicket: (id: string, data: Record<string, unknown>) => api.patch(`/tickets/${id}`, data),
  deleteTicket: (id: string) => api.delete(`/tickets/${id}`),
  addComment: (ticketId: string, data: { comment_text: string; is_internal?: boolean }) =>
    api.post(`/tickets/${ticketId}/comments`, data),
  getComments: (ticketId: string) => api.get(`/tickets/${ticketId}/comments`),
};
