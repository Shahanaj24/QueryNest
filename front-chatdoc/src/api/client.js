/**
 * Central API client.
 *
 * Replaces the two competing approaches in the original code (a bare `fetch`
 * in FileUpload and a separate axios instance in ChatInterface) with one
 * configured instance that attaches the auth token and normalises errors.
 */

import axios from 'axios';

const TOKEN_KEY = 'chatdoc.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  // Generous: embedding a PDF and calling Gemini can take a while. The original
  // 10s timeout caused spurious "could not get response" errors.
  timeout: 120000,
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the token is gone or expired: clear it and let the app redirect.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new Event('chatdoc:unauthorized'));
    }
    return Promise.reject(error);
  },
);

/**
 * Turn any axios failure into a sentence worth showing a user.
 * The backend already sends safe `detail` strings; this covers the cases where
 * the request never reached it.
 */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;

  if (error?.code === 'ECONNABORTED') {
    return 'That took too long to respond. Please try again.';
  }
  if (error?.response === undefined) {
    return 'Cannot reach the server. Check that the backend is running.';
  }
  return fallback;
}

/**
 * Endpoint wrappers, grouped so pages never build URLs by hand.
 *
 * The list endpoints return bare JSON arrays (idiomatic REST), so they are
 * normalised here into named keys. That way a page reads `data.conversations`
 * and never has to care which shape the transport used.
 */
export const authApi = {
  register: (data) => api.post('/api/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/api/auth/login', data).then((r) => r.data),
  logout: () => api.post('/api/auth/logout').then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data),
};

export const userApi = {
  profile: () => api.get('/api/users/profile').then((r) => r.data),
  updateProfile: (data) => api.put('/api/users/profile', data).then((r) => r.data),
};

export const documentApi = {
  // GET /api/documents -> [{...}]
  list: () => api.get('/api/documents').then((r) => ({ documents: r.data })),
  // POST /api/documents/upload -> { document, message }
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/api/documents/upload', form, {
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      })
      .then((r) => r.data);
  },
  remove: (id) => api.delete(`/api/documents/${id}`).then((r) => r.data),
};

export const conversationApi = {
  // GET /api/conversations -> [{...}]
  list: async () => {
    const conversations = await api.get('/api/conversations').then((r) => r.data);
    return { conversations };
  },
  // POST /api/conversations -> a single conversation
  create: async (title) => {
    const conversation = await api
      .post('/api/conversations', { title: title ?? null })
      .then((r) => r.data);
    return { conversation };
  },
  /** Full conversation including its messages. */
  get: (id) => api.get(`/api/conversations/${id}`).then((r) => r.data),
  /** Message history only. */
  messages: (id) => api.get(`/api/conversations/${id}/messages`).then((r) => r.data),
  remove: (id) => api.delete(`/api/conversations/${id}`).then((r) => r.data),
  /**
   * Ask a question. Returns
   * { conversationId, title, userMessage, assistantMessage }.
   */
  sendMessage: (id, content) =>
    api.post(`/api/conversations/${id}/messages`, { content }).then((r) => r.data),
};
