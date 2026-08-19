'use client';

/**
 * useVideoGeneration Hook
 * 视频生成过程控制 - 支持停止、暂停、进度追踪
 */

import { useState, useCallback, useRef } from 'react';

export type GenerationStatus = 'idle' | 'preparing' | 'generating' | 'paused' | 'stopped' | 'completed' | 'error';

export interface GenerationStep {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    duration?: number; // 耗时（毫秒）
}

export interface GenerationCost {
    points: number;
    videoDuration: number;
    segments: number;
    music: number;
    voiceover: number;
    subtitle: number;
}

// 生成参数
export interface GenerateParams {
    script: string;
    segments: {
        prompt: string;
        duration: number;
    }[];
    style?: string;
    voiceover?: {
        text: string;
        voice: string;
        provider: string;
    };
    music?: {
        emotion: string;
        loop?: boolean;
    };
    subtitle?: {
        enabled: boolean;
        style?: string;
    };
}

interface UseVideoGenerationReturn {
    // 状态
    status: GenerationStatus;
    progress: number;
    currentStep: string;
    steps: GenerationStep[];
    cost: GenerationCost;
    error: string | null;
    
    // 控制方法
    start: (params: GenerateParams) => Promise<void>;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    
    // 进度更新
    updateStep: (stepId: string, progress: number, message?: string) => void;
    completeStep: (stepId: string) => void;
    failStep: (stepId: string, error: string) => void;
}

export function useVideoGeneration(): UseVideoGenerationReturn {
    const [status, setStatus] = useState<GenerationStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [steps, setSteps] = useState<GenerationStep[]>([]);
    const [cost, setCost] = useState<GenerationCost>({
        points: 0,
        videoDuration: 0,
        segments: 0,
        music: 0,
        voiceover: 0,
        subtitle: 0,
    });
    const [error, setError] = useState<string | null>(null);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const startTimeRef = useRef<number>(0);

    // 计算成本
    const calculateCost = useCallback((params: GenerateParams): GenerationCost => {
        const segmentCost = params.segments.length * 10; // 每段 10 积分
        const voiceoverCost = params.voiceover 
            ? Math.ceil(params.voiceover.text.length * 0.01) 
            : 0;
        const musicCost = params.music ? 2 : 0;
        const subtitleCost = params.subtitle?.enabled ? 2 : 0;
        
        const totalDuration = params.segments.reduce((sum, s) => sum + s.duration, 0);
        
        return {
            points: segmentCost + voiceoverCost + musicCost + subtitleCost,
            videoDuration: totalDuration,
            segments: segmentCost,
            music: musicCost,
            voiceover: voiceoverCost,
            subtitle: subtitleCost,
        };
    }, []);

    // 初始化步骤
    const initSteps = useCallback((params: GenerateParams) => {
        const newSteps: GenerationStep[] = [];
        let stepId = 0;
        
        // 准备阶段
        newSteps.push({
            id: `step-${++stepId}`,
            name: '准备生成',
            status: 'pending',
            progress: 0,
        });
        
        // 配音生成
        if (params.voiceover) {
            newSteps.push({
                id: `step-${++stepId}`,
                name: '生成配音',
                status: 'pending',
                progress: 0,
                message: '正在调用 AI 配音服务...',
            });
        }
        
        // 字幕生成
        if (params.subtitle?.enabled) {
            newSteps.push({
                id: `step-${++stepId}`,
                name: '生成字幕',
                status: 'pending',
                progress: 0,
            });
        }
        
        // 音乐生成
        if (params.music) {
            newSteps.push({
                id: `step-${++stepId}`,
                name: '匹配背景音乐',
                status: 'pending',
                progress: 0,
            });
        }
        
        // 视频片段生成
        params.segments.forEach((segment, index) => {
            newSteps.push({
                id: `step-${++stepId}`,
                name: `生成片段 ${index + 1}/${params.segments.length}`,
                status: 'pending',
                progress: 0,
                message: segment.prompt.substring(0, 50) + '...',
            });
        });
        
        // 合成阶段
        newSteps.push({
            id: `step-${++stepId}`,
            name: '合成视频',
            status: 'pending',
            progress: 0,
            message: '正在合并所有素材...',
        });
        
        // 完成阶段
        newSteps.push({
            id: `step-${++stepId}`,
            name: '完成',
            status: 'pending',
            progress: 100,
        });
        
        return newSteps;
    }, []);

    // 开始生成
    const start = useCallback(async (params: GenerateParams) => {
        // 重置状态
        setStatus('preparing');
        setProgress(0);
        setError(null);
        setSteps(initSteps(params));
        setCost(calculateCost(params));
        
        // 创建 AbortController
        abortControllerRef.current = new AbortController();
        startTimeRef.current = Date.now();
        
        try {
            // 调用生成 API
            setStatus('generating');
            
            const response = await fetch('/api/video/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
                signal: abortControllerRef.current.signal,
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '生成失败');
            }
            
            // 处理流式响应
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            
            if (!reader) {
                throw new Error('无法读取响应流');
            }
            
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // 解析 JSON 行
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            // 更新步骤状态
                            if (data.step) {
                                setSteps(prev => prev.map(step => {
                                    if (step.id === data.stepId) {
                                        return {
                                            ...step,
                                            status: data.step === 'running' ? 'running' : step.status,
                                            progress: data.progress || step.progress,
                                            message: data.message || step.message,
                                        };
                                    }
                                    return step;
                                }));
                                
                                setCurrentStep(data.step);
                                setProgress(data.progress || 0);
                            }
                            
                            // 完成
                            if (data.done) {
                                setStatus('completed');
                                setProgress(100);
                            }
                            
                            // 错误
                            if (data.error) {
                                setStatus('error');
                                setError(data.error);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setStatus('stopped');
                setError('生成已停止');
            } else {
                setStatus('error');
                setError(err instanceof Error ? err.message : '生成失败');
            }
        } finally {
            abortControllerRef.current = null;
        }
    }, [initSteps, calculateCost]);

    // 停止生成
    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setStatus('stopped');
    }, []);

    // 暂停生成
    const pause = useCallback(() => {
        if (status === 'generating') {
            setStatus('paused');
        }
    }, [status]);

    // 恢复生成
    const resume = useCallback(() => {
        if (status === 'paused') {
            setStatus('generating');
        }
    }, [status]);

    // 重置
    const reset = useCallback(() => {
        setStatus('idle');
        setProgress(0);
        setCurrentStep('');
        setSteps([]);
        setCost({
            points: 0,
            videoDuration: 0,
            segments: 0,
            music: 0,
            voiceover: 0,
            subtitle: 0,
        });
        setError(null);
        abortControllerRef.current = null;
    }, []);

    // 更新步骤
    const updateStep = useCallback((stepId: string, stepProgress: number, message?: string) => {
        setSteps(prev => prev.map(step => {
            if (step.id === stepId) {
                return {
                    ...step,
                    progress: stepProgress,
                    message: message || step.message,
                };
            }
            return step;
        }));
        
        // 计算总体进度
        const completedSteps = steps.filter(s => s.status === 'completed').length;
        const runningStep = steps.find(s => s.status === 'running');
        const totalProgress = ((completedSteps + (runningStep ? stepProgress / 100 : 0)) / steps.length) * 100;
        setProgress(totalProgress);
    }, [steps]);

    // 完成步骤
    const completeStep = useCallback((stepId: string) => {
        setSteps(prev => prev.map(step => {
            if (step.id === stepId) {
                return {
                    ...step,
                    status: 'completed',
                    progress: 100,
                    duration: Date.now() - startTimeRef.current,
                };
            }
            return step;
        }));
    }, []);

    // 步骤失败
    const failStep = useCallback((stepId: string, errorMessage: string) => {
        setSteps(prev => prev.map(step => {
            if (step.id === stepId) {
                return {
                    ...step,
                    status: 'failed',
                    message: errorMessage,
                };
            }
            return step;
        }));
        setStatus('error');
        setError(errorMessage);
    }, []);

    return {
        status,
        progress,
        currentStep,
        steps,
        cost,
        error,
        start,
        stop,
        pause,
        resume,
        reset,
        updateStep,
        completeStep,
        failStep,
    };
}
