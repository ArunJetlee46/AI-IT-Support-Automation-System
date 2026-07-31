import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `******;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API calls
export const authAPI = {
  register: (data: { email: string; password: string; name: string; user_type: 'internal' | 'external' }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () =>
    api.post('/auth/logout'),
  getProfile: () =>
    api.get('/auth/me'),
};

// Metadata API calls
export const metadataAPI = {
  getCategories: () =>
    api.get('/categories'),
  getPriorities: () =>
    api.get('/priorities'),
  getStatuses: () =>
    api.get('/statuses'),
};

export const ticketAPI = {
  createTicket: (data: any) =>
    api.post('/tickets', data),
  getTickets: (params?: any) =>
    api.get('/tickets', { params }),
  getTicket: (id: string) =>
    api.get(`/tickets/${id}`),
  updateTicket: (id: string, data: any) =>
    api.patch(`/tickets/${id}`, data),
  deleteTicket: (id: string) =>
    api.delete(`/tickets/${id}`),
  addComment: (ticketId: string, data: any) =>
    api.post(`/tickets/${ticketId}/comments`, data),
  getComments: (ticketId: string) =>
    api.get(`/tickets/${ticketId}/comments`),
};
