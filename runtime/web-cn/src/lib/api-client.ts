/**
 * API Client for Fenfa AI
 * Handles authentication headers, base URL, and common fetch logic.
 */

import { apiErrorText } from './api-error';

const BASE_URL = '/api/v1';

/**
 * 面向用户的友好错误：API 客户端层统一把网络/解析失败收敛为中文提示，
 * 禁止把 JSON 解析错误等异常原文（如 Unexpected token ...）渲染上屏。
 */
export class FriendlyApiError extends Error {
    status?: number;
    code?: string;
    compliance?: {
        disclaimer?: string;
        level?: string;
        hits?: Array<{ ruleId?: string; severity?: string; reason?: string }>;
    };
}

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

        return headers;
    }

    async get<T>(path: string, init?: { redirectOn401?: boolean }): Promise<T> {
        return this.request<T>('GET', path, undefined, init);
    }

    async post<T>(path: string, body: any): Promise<T> {
        return this.request<T>('POST', path, body);
    }

    async put<T>(path: string, body: any): Promise<T> {
        return this.request<T>('PUT', path, body);
    }

    async patch<T>(path: string, body: any): Promise<T> {
        return this.request<T>('PATCH', path, body);
    }

    async delete<T>(path: string): Promise<T> {
        return this.request<T>('DELETE', path);
    }

    private async request<T>(method: string, path: string, body?: any, init?: { redirectOn401?: boolean }): Promise<T> {
        let response: Response;
        try {
            response = await fetch(`${BASE_URL}${path}`, {
                method,
                headers: this.getHeaders(),
                body: body === undefined ? undefined : JSON.stringify(body),
                credentials: 'include',
            });
        } catch {
            // 网络层失败（断网、后端不可达）：统一为友好中文，不外泄底层异常原文。
            throw new FriendlyApiError('网络连接失败，请稍后重试');
        }
        return this.handleResponse<T>(response, init?.redirectOn401 !== false);
    }

    private async handleResponse<T>(response: Response, redirectOn401 = true): Promise<T> {
        if (response.status === 401 && redirectOn401) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }

        let data: any;
        try {
            data = await response.json();
        } catch {
            // 上游返回非 JSON（如后端未启动时的 HTML 错误页）：统一友好提示。
            throw new FriendlyApiError('服务响应异常，请稍后重试');
        }

        if (!response.ok) {
            // 后端的错误在 error.message 里（信封 { success:false, error:{ message } }），
            // 只认中文；没有中文原因才用通用提示。
            const failure = new FriendlyApiError(apiErrorText(data) ?? '服务响应异常，请稍后重试');
            failure.status = response.status;
            if (typeof data?.error?.code === 'string') failure.code = data.error.code;
            const compliance = data?.error?.compliance;
            if (compliance && typeof compliance === 'object') failure.compliance = compliance;
            throw failure;
        }

        // The NestJS backend wraps successful payloads in { success, data,
        // message }. Keep the client contract Promise<T> truthful by
        // unwrapping exactly that envelope; plain responses remain supported.
        if (
            data &&
            typeof data === 'object' &&
            data.success === true &&
            Object.prototype.hasOwnProperty.call(data, 'data')
        ) {
            return data.data as T;
        }
        return data as T;
    }
}

export const apiClient = new ApiClient();
