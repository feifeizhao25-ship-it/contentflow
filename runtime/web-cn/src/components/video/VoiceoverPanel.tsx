'use client';

import React, { useState, useCallback } from 'react';
import { 
    Voice, 
    getAllVoices, 
    getVoicesByProvider, 
    generateSpeech, 
    calculateTTSCost, 
    estimateVoiceoverDuration,
    TTSProvider,
    VoiceGender
} from '@/lib/tts-service';

interface VoiceoverPanelProps {
    script: string;
    duration?: number;
    onVoiceoverGenerated?: (audioUrl: string, duration: number, cost: number) => void;
    onCancel?: () => void;
}

export default function VoiceoverPanel({
    script,
    duration = 60,
    onVoiceoverGenerated,
    onCancel
}: VoiceoverPanelProps) {
    // 状态
    const [selectedProvider, setSelectedProvider] = useState<TTSProvider>('openai');
    const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
    const [speed, setSpeed] = useState(1.0);
    const [pitch, setPitch] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [generatedAudio, setGeneratedAudio] = useState<{ url: string; duration: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 获取声音列表
    const voices = getAllVoices();
    const providerVoices = getVoicesByProvider(selectedProvider);

    // 计算成本和时长
    const cost = calculateTTSCost(script, selectedProvider);
    const estimatedDuration = estimateVoiceoverDuration(script, speed);

    // 选择声音处理器
    const handleVoiceSelect = (voiceId: string) => {
        setSelectedVoice(voiceId);
    };

    // 生成配音
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        setProgress(10);
        setError(null);

        try {
            const result = await generateSpeech({
                text: script,
                voice: selectedVoice,
                provider: selectedProvider,
                speed,
                pitch,
            });

            setProgress(100);
            setGeneratedAudio({ url: result.audioUrl, duration: result.duration });
            
            onVoiceoverGenerated?.(result.audioUrl, result.duration, result.cost);
        } catch (err) {
            setProgress(0);
            setError(err instanceof Error ? err.message : '配音生成失败');
        } finally {
            setIsGenerating(false);
        }
    }, [script, selectedVoice, selectedProvider, speed, pitch, onVoiceoverGenerated]);

    // 播放音频
    const handlePlay = () => {
        if (generatedAudio) {
            const audio = new Audio(generatedAudio.url);
            audio.play();
        }
    };

    // 下载音频
    const handleDownload = () => {
        if (generatedAudio) {
            const a = document.createElement('a');
            a.href = generatedAudio.url;
            a.download = 'voiceover.mp3';
            a.click();
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">🎙️</span>
                AI 配音设置
            </h2>

            {/* 错误提示 */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* 脚本预览 */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    配音文本
                </label>
                <div className="bg-gray-50 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">
                    {script}
                </div>
            </div>

            {/* 提供商选择 */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    TTS 提供商
                </label>
                <div className="flex gap-2">
                    {[
                        { id: 'openai', name: 'OpenAI', desc: '平衡选择', color: 'bg-green-500' },
                        { id: 'azure', name: 'Azure', desc: '便宜稳定', color: 'bg-blue-500' },
                        { id: 'elevenlabs', name: 'ElevenLabs', desc: '最佳音质', color: 'bg-purple-500' },
                    ].map(provider => (
                        <button
                            key={provider.id}
                            onClick={() => setSelectedProvider(provider.id as TTSProvider)}
                            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                                selectedProvider === provider.id
                                    ? `border-${provider.color.replace('bg-', '')} ${provider.color} text-white`
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs opacity-80">{provider.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 声音选择 */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择声音
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {providerVoices.map(voice => (
                        <button
                            key={voice.id}
                            onClick={() => handleVoiceSelect(voice.id)}
                            className={`text-left p-3 rounded-lg border-2 transition-all ${
                                selectedVoice === voice.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">
                                    {voice.gender === 'male' ? '👨' : voice.gender === 'female' ? '👩' : '🧑'}
                                </span>
                                <div>
                                    <div className="font-medium">{voice.name}</div>
                                    <div className="text-xs text-gray-500">{voice.description}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 声音参数 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        语速: {speed.toFixed(1)}x
                    </label>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>慢</span>
                        <span>正常</span>
                        <span>快</span>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        音调: {pitch > 0 ? '+' : ''}{pitch}
                    </label>
                    <input
                        type="range"
                        min="-20"
                        max="20"
                        step="1"
                        value={pitch}
                        onChange={(e) => setPitch(parseInt(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>低</span>
                        <span>正常</span>
                        <span>高</span>
                    </div>
                </div>
            </div>

            {/* 成本和时长预估 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-sm text-gray-500">预计时长</div>
                        <div className="text-xl font-bold">{estimatedDuration}秒</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">积分消耗</div>
                        <div className="text-xl font-bold text-orange-500">{cost} 积分</div>
                    </div>
                </div>
            </div>

            {/* 生成按钮 */}
            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    取消
                </button>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !script.trim()}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                        isGenerating
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                    }`}
                >
                    {isGenerating ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {progress === 100 ? '配音已生成' : '服务端正在生成配音...'}
                        </span>
                    ) : (
                        '🎙️ 生成配音'
                    )}
                </button>
            </div>

            {/* 生成结果 */}
            {generatedAudio && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-green-700 font-medium">✅ 配音生成成功</span>
                        <span className="text-sm text-green-600">{generatedAudio.duration}秒</span>
                    </div>
                    <audio controls src={generatedAudio.url} className="w-full mb-2" />
                    <div className="flex gap-2">
                        <button
                            onClick={handlePlay}
                            className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                            🔊 播放
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            ⬇️ 下载
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== 声音选择器组件 ====================

interface VoiceSelectorProps {
    provider: TTSProvider;
    selectedVoice: string;
    onVoiceSelect: (voiceId: string) => void;
}

export function VoiceSelector({ provider, selectedVoice, onVoiceSelect }: VoiceSelectorProps) {
    const voices = getVoicesByProvider(provider);

    return (
        <div className="grid grid-cols-3 gap-2">
            {voices.map(voice => (
                <button
                    key={voice.id}
                    onClick={() => onVoiceSelect(voice.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedVoice === voice.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">
                            {voice.gender === 'male' ? '👨' : voice.gender === 'female' ? '👩' : '🧑'}
                        </span>
                        <div>
                            <div className="font-medium text-sm">{voice.name}</div>
                            <div className="text-xs text-gray-500">{voice.language}</div>
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}

// ==================== 快速配音预览 ====================

interface QuickVoiceoverProps {
    text: string;
    onComplete?: (audioUrl: string) => void;
}

export function QuickVoiceover({ text, onComplete }: QuickVoiceoverProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const handlePreview = async () => {
        setIsPlaying(true);
        try {
            const result = await generateSpeech({
                text: text.slice(0, 200), // 限制预览长度
                voice: 'alloy',
                provider: 'openai',
            });
            setAudioUrl(result.audioUrl);
            onComplete?.(result.audioUrl);
            
            const audio = new Audio(result.audioUrl);
            audio.onended = () => setIsPlaying(false);
            audio.play();
        } catch {
            setIsPlaying(false);
        }
    };

    return (
        <button
            onClick={handlePreview}
            disabled={isPlaying}
            className={`px-3 py-1 rounded text-sm ${
                isPlaying
                    ? 'bg-gray-200 text-gray-500 cursor-wait'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
        >
            {isPlaying ? '🔊 播放中...' : '🎵 预览配音'}
        </button>
    );
}
