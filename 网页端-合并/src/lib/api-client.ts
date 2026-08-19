/**
 * API Client for Fenfa AI
 * Handles authentication headers, base URL, and common fetch logic.
 */

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const BASE_URL = `${API_ORIGIN}/api/v1`;

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

class ApiClient {
    private getHeaders() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // FORCE mock-token for demo purposes to ensure it works
        if (typeof window !== 'undefined') {
            headers['Authorization'] = `Bearer mock-token`;
            localStorage.setItem('auth_token', 'mock-token');
        }

        return headers;
    }

    async get<T>(path: string): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include',
        });
        return this.handleResponse<T>(response);
    }

    async post<T>(path: string, body: any): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
        });
        return this.handleResponse<T>(response);
    }

    async put<T>(path: string, body: any): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
        });
        return this.handleResponse<T>(response);
    }

    async patch<T>(path: string, body: any): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
        });
        return this.handleResponse<T>(response);
    }

    async delete<T>(path: string): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            credentials: 'include',
        });
        return this.handleResponse<T>(response);
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (response.status === 401) {
            // DEMO MODE: Disable auto-logout/redirect
            console.warn('Unauthorized request detected, but redirect suppressed in demo mode.');
            /*
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
            }
            */
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        // The NestJS backend uses a TransformInterceptor that wraps data in { data, success, message }
        return data;
    }
}

export const apiClient = new ApiClient();
