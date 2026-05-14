import axios from 'axios';

// Default to same-origin proxy ('/auth-api') so auth cookies stick across
// browsers (Safari ITP, Chrome incognito, etc.). The reverse proxy is
// configured in vercel.json + nginx.conf and rewrites /auth-api/* to the
// real auth service.
//
// Rollback: set VITE_AUTH_SERVICE_URL=https://nomikos-auth-service.onrender.com
// in the deploy environment (Vercel project settings / Render env) to bypass
// the proxy and hit the auth service directly. No code change needed.
const API_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || '/auth-api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export interface AuthResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
    };
  };
  message?: string;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (err: any) {
      let message = 'Login failed. Please try again.';
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        message = err.response.data.error || err.response.data.message;
      } else if (err.message) {
        message = err.message.includes('Network Error') ? 'Cannot reach authentication server. Please check your connection.' : err.message;
      }
      return { success: false, error: message };
    }
  },

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/signup', credentials);
      return response.data;
    } catch (err: any) {
      let message = 'Signup failed. Please try again.';
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        message = err.response.data.error || err.response.data.message;
      } else if (err.message) {
        message = err.message.includes('Network Error') ? 'Cannot reach authentication server. Please check your connection.' : err.message;
      }
      return { success: false, error: message };
    }
  },

  async logout(): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/logout');
      return response.data;
    } catch (err: any) {
      let message = 'Logout failed. Please try again.';
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        message = err.response.data.error || err.response.data.message;
      } else if (err.message) {
        message = err.message.includes('Network Error') ? 'Cannot reach authentication server.' : err.message;
      }
      return { success: false, error: message };
    }
  },

  async getMe(): Promise<AuthResponse> {
    try {
      const response = await apiClient.get<AuthResponse>('/auth/me');
      return response.data;
    } catch (err: any) {
      let message = 'Unable to fetch user details.';
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        message = err.response.data.error || err.response.data.message;
      } else if (err.message) {
        message = err.message.includes('Network Error') ? 'Cannot reach authentication server.' : err.message;
      }
      return { success: false, error: message };
    }
  },

  async exchangeCode(code: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/exchange', { code });
      return response.data;
    } catch (err: any) {
      let message = 'Unable to complete authentication. Please try again.';
      if (err.response && err.response.data && (err.response.data.error || err.response.data.message)) {
        message = err.response.data.error || err.response.data.message;
      } else if (err.message) {
        message = err.message.includes('Network Error') ? 'Cannot reach authentication server.' : err.message;
      }
      return { success: false, error: message };
    }
  },

  async confirmEmail(payload: {
  token_hash: string;
  type: string;
}): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    '/auth/confirm',
    payload
  );

  return response.data;
},

  initiateGoogleOAuth(): void {
    const frontendUrl = window.location.origin;
    window.location.href = `${API_BASE_URL}/auth/google?redirect_to=${encodeURIComponent(frontendUrl)}`;
  },
};

export default authApi;
