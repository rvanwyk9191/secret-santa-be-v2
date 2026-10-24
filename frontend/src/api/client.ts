import axios from 'axios';

/**
 * Shared Axios instance for all backend API calls.
 *
 * - baseURL points to the backend API (proxied by Vite in dev via /api → localhost:8080)
 * - withCredentials: true so the HttpOnly access_token cookie is sent on every request
 */
const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;
