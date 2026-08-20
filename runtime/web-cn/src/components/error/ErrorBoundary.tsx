'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, Result } from 'antd';
import { ReloadOutlined, HomeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/studio';
    };

    private handleReport = () => {
        // 收集错误信息
        const errorReport = {
            message: this.state.error?.message,
            stack: this.state.error?.stack,
            componentStack: this.state.errorInfo?.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        console.log('Error Report:', JSON.stringify(errorReport, null, 2));
        
        // 这里可以发送到错误监控服务
        // await fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorReport) });
        
        alert('错误报告已生成，请在控制台查看详细信息');
    };

    public render() {
        if (this.state.hasError) {
            // 自定义错误页面
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-indigo-50">
                    <Card className="max-w-lg w-full shadow-xl rounded-2xl">
                        <Result
                            status="error"
                            icon={<ExclamationCircleOutlined className="text-red-500" />}
                            title="页面出错了"
                            subTitle="很抱歉，遇到了技术问题。请尝试刷新页面或返回首页。"
                            extra={[
                                <Button 
                                    key="reload" 
                                    type="primary"
                                    icon={<ReloadOutlined />}
                                    onClick={this.handleReload}
                                    className="!rounded-lg"
                                >
                                    刷新页面
                                </Button>,
                                <Button 
                                    key="home"
                                    icon={<HomeOutlined />}
                                    onClick={this.handleGoHome}
                                    className="!rounded-lg"
                                >
                                    返回首页
                                </Button>
                            ]}
                        />
                        
                        {/* 错误详情（开发环境显示） */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                                <h4 className="text-red-700 font-medium mb-2">错误详情：</h4>
                                <p className="text-red-600 text-sm font-mono mb-2">
                                    {this.state.error.message}
                                </p>
                                {this.state.error.stack && (
                                    <pre className="text-xs text-red-500 overflow-auto max-h-40 p-2 bg-white rounded">
                                        {this.state.error.stack}
                                    </pre>
                                )}
                                <Button 
                                    size="small" 
                                    onClick={this.handleReport}
                                    className="mt-3"
                                >
                                    报告错误
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

// 函数式错误边界包装组件
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}

// API 错误处理 Hook
export function useApiError() {
    const [error, setError] = React.useState<Error | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    const resetError = () => setError(null);

    const handleApiCall = async <T,>(
        apiFunction: () => Promise<T>,
        options?: {
            onSuccess?: (data: T) => void;
            onError?: (error: Error) => void;
        }
    ): Promise<T | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await apiFunction();
            options?.onSuccess?.(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('未知错误');
            setError(error);
            options?.onError?.(error);
            console.error('API Error:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        error,
        isLoading,
        resetError,
        handleApiCall
    };
}

// 网络状态检测
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = React.useState(true);
    const [isSlowNetwork, setIsSlowNetwork] = React.useState(false);

    React.useEffect(() => {
        const updateStatus = () => {
            setIsOnline(navigator.onLine);
        };

        // 监听网络状态变化
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // 检测网络速度（通过测量资源加载时间）
        const measureNetworkSpeed = async () => {
            const start = performance.now();
            try {
                await fetch('/api/health', { method: 'HEAD' });
                const duration = performance.now() - start;
                setIsSlowNetwork(duration > 3000); // 超过3秒认为慢网络
            } catch {
                setIsSlowNetwork(true);
            }
        };

        measureNetworkSpeed();

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
        };
    }, []);

    return { isOnline, isSlowNetwork };
}

// 离线状态组件
export function OfflineIndicator() {
    const { isOnline, isSlowNetwork } = useNetworkStatus();

    if (isOnline) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 text-center text-sm z-50">
            <span>⚠️ 您当前处于离线状态，部分功能可能不可用</span>
        </div>
    );
}

// 慢网络提示组件
export function SlowNetworkIndicator() {
    const { isSlowNetwork } = useNetworkStatus();
    const [dismissed, setDismissed] = React.useState(false);

    if (!isSlowNetwork || dismissed) return null;

    return (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-orange-100 border border-orange-300 text-orange-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-40">
            <span>🐌 网络较慢，请耐心等待...</span>
            <button 
                onClick={() => setDismissed(true)}
                className="text-orange-500 hover:text-orange-700"
            >
                ✕
            </button>
        </div>
    );
}
