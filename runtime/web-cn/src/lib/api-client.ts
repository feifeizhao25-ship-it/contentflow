/**
 * API Client for Fenfa AI
 * Handles authentication headers, base URL, and common fetch logic.
 */

const BASE_URL = '/api/v1';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export class ApiClientError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly details: Record<string, any> = {},
    ) {
        super(message);
        this.name = 'ApiClientError';
    }
}

class ApiClient {
    private getHeaders() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

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
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new ApiClientError(
                data.message || data.error || '请求失败，请稍后重试',
                response.status,
                data,
            );
        }

        // The NestJS backend uses a TransformInterceptor that wraps data in { data, success, message }
        return data;
    }
}

export const apiClient = new ApiClient();
