'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    SubtitleItem,
    SubtitleStyle,
    SubtitleStylePreset,
    getSubtitleStyle,
    getAllSubtitleStyles,
    generateSubtitlesFromScript,
    calculateSubtitleCost,
    SubtitleFormat,
    exportSubtitles,
} from '@/lib/subtitle-service';

interface SubtitleEditorProps {
    script: string;
    duration: number;
    subtitles?: SubtitleItem[];
    onSubtitlesChange?: (subtitles: SubtitleItem[]) => void;
    onStyleChange?: (style: SubtitleStyle) => void;
    onExport?: (format: SubtitleFormat, content: string) => void;
}

export default function SubtitleEditor({
    script,
    duration,
    subtitles: initialSubtitles,
    onSubtitlesChange,
    onStyleChange,
    onExport,
}: SubtitleEditorProps) {
    // 字幕列表
    const [subtitles, setSubtitles] = useState<SubtitleItem[]>(initialSubtitles || []);
    
    // 选中的字幕
    const [selectedId, setSelectedId] = useState<string | null>(null);
    
    // 样式
    const [style, setStyle] = useState<SubtitleStyle>(getSubtitleStyle('modern'));
    
    // 编辑模式
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    
    // 预览时间
    const [previewTime, setPreviewTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // 预览视频
    const videoRef = useRef<HTMLVideoElement>(null);

    // 样式列表
    const styleOptions = getAllSubtitleStyles();

    // 初始化字幕
    useEffect(() => {
        if (!initialSubtitles && script) {
            const generated = generateSubtitlesFromScript(script, duration);
            setSubtitles(generated);
            onSubtitlesChange?.(generated);
        }
    }, [script, duration, initialSubtitles, onSubtitlesChange]);

    // 预览播放
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                setPreviewTime(prev => {
                    if (prev >= duration) {
                        setIsPlaying(false);
                        return 0;
                    }
                    return prev + 0.1;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, duration]);

    // 获取当前时间的字幕
    const currentSubtitle = subtitles.find(
        s => previewTime >= s.startTime && previewTime <= s.endTime
    );

    // 更新字幕文本
    const handleUpdateText = (id: string, newText: string) => {
        const updated = subtitles.map(s =>
            s.id === id ? { ...s, text: newText } : s
        );
        setSubtitles(updated);
        onSubtitlesChange?.(updated);
    };

    // 开始编辑
    const startEdit = (subtitle: SubtitleItem) => {
        setSelectedId(subtitle.id);
        setEditText(subtitle.text);
        setIsEditing(true);
    };

    // 保存编辑
    const saveEdit = () => {
        if (selectedId) {
            handleUpdateText(selectedId, editText);
        }
        setIsEditing(false);
        setSelectedId(null);
    };

    // 删除字幕
    const handleDelete = (id: string) => {
        const updated = subtitles.filter(s => s.id !== id);
        setSubtitles(updated);
        onSubtitlesChange?.(updated);
    };

    // 添加字幕
    const handleAdd = () => {
        const last = subtitles[subtitles.length - 1];
        const newSubtitle: SubtitleItem = {
            id: `subtitle-${Date.now()}`,
            startTime: last ? last.endTime + 0.5 : 0,
            endTime: last ? last.endTime + 3.5 : 3,
            text: '新字幕',
        };
        const updated = [...subtitles, newSubtitle];
        setSubtitles(updated);
        onSubtitlesChange?.(updated);
    };

    // 应用样式
    const handleStyleChange = (preset: SubtitleStylePreset) => {
        const newStyle = getSubtitleStyle(preset);
        setStyle(newStyle);
        onStyleChange?.(newStyle);
    };

    // 导出字幕
    const handleExport = (format: SubtitleFormat) => {
        const content = exportSubtitles(subtitles, format);
        onExport?.(format, content);
        
        // 下载文件
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitles.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 成本计算
    const cost = calculateSubtitleCost(subtitles);

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">📝</span>
                字幕编辑器
            </h2>

            <div className="grid grid-cols-2 gap-6">
                {/* 左侧：预览区域 */}
                <div>
                    {/* 预览视频区域 */}
                    <div className="relative bg-black rounded-lg overflow-hidden mb-4 aspect-video">
                        {/* 模拟视频画面 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-white text-center">
                                <div className="text-6xl mb-4">🎬</div>
                                <div className="text-sm">视频预览区域</div>
                            </div>
                        </div>

                        {/* 字幕预览 */}
                        {currentSubtitle && (
                            <div
                                className="absolute bottom-8 left-4 right-4 text-center"
                                style={{
                                    fontFamily: style.fontFamily,
                                    fontSize: `${style.fontSize}px`,
                                    fontWeight: style.fontWeight,
                                    color: style.textColor,
                                    textShadow: style.shadowBlur > 0
                                        ? `${style.shadowOffset}px ${style.shadowOffset}px ${style.shadowBlur}px ${style.shadowColor}`
                                        : 'none',
                                    WebkitTextStroke: style.strokeWidth > 0
                                        ? `${style.strokeWidth}px ${style.strokeColor}`
                                        : 'none',
                                    backgroundColor: style.backgroundOpacity > 0
                                        ? style.backgroundColor
                                        : 'transparent',
                                    padding: style.backgroundOpacity > 0 ? '8px 16px' : '0',
                                    borderRadius: style.backgroundOpacity > 0 ? '4px' : '0',
                                }}
                            >
                                {currentSubtitle.text}
                            </div>
                        )}

                        {/* 时间码 */}
                        <div className="absolute top-4 right-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
                            {previewTime.toFixed(1)}s
                        </div>
                    </div>

                    {/* 播放控制 */}
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center hover:bg-purple-600 transition-colors"
                        >
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max={duration}
                            step="0.1"
                            value={previewTime}
                            onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
                            className="flex-1"
                        />
                        <span className="text-sm text-gray-500">
                            {duration.toFixed(0)}s
                        </span>
                    </div>

                    {/* 样式选择 */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            字幕样式
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {styleOptions.map(opt => (
                                <button
                                    key={opt.preset}
                                    onClick={() => handleStyleChange(opt.preset)}
                                    className={`p-2 rounded-lg border-2 text-center transition-all ${
                                        style.preset === opt.preset
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="text-xs font-medium">{opt.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 导出 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            导出字幕
                        </label>
                        <div className="flex gap-2">
                            {(['srt', 'vtt', 'ass', 'lrc'] as SubtitleFormat[]).map(format => (
                                <button
                                    key={format}
                                    onClick={() => handleExport(format)}
                                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    .{format.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧：字幕列表 */}
                <div>
                    {/* 成本信息 */}
                    <div className="bg-orange-50 rounded-lg p-3 mb-4 flex justify-between items-center">
                        <span className="text-sm text-orange-700">
                            字幕共 {subtitles.length} 条
                        </span>
                        {cost > 0 && (
                            <span className="text-sm text-orange-600">
                                AI识别消耗 {cost} 积分
                            </span>
                        )}
                    </div>

                    {/* 字幕列表 */}
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                        {subtitles.map((subtitle, index) => (
                            <div
                                key={subtitle.id}
                                className={`p-3 border-b last:border-b-0 ${
                                    selectedId === subtitle.id
                                        ? 'bg-blue-50'
                                        : 'hover:bg-gray-50'
                                }`}
                                onClick={() => setSelectedId(subtitle.id)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-gray-500">
                                        {subtitle.startTime.toFixed(1)}s - {subtitle.endTime.toFixed(1)}s
                                    </span>
                                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                                        #{index + 1}
                                    </span>
                                </div>
                                
                                {isEditing && selectedId === subtitle.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full p-2 border rounded resize-none"
                                            rows={2}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={saveEdit}
                                                className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                                            >
                                                保存
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="px-3 py-1 bg-gray-300 rounded text-sm"
                                            >
                                                取消
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm flex-1">{subtitle.text}</p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEdit(subtitle);
                                                }}
                                                className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(subtitle.id);
                                                }}
                                                className="p-1 text-red-500 hover:bg-red-100 rounded"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 添加按钮 */}
                    <button
                        onClick={handleAdd}
                        className="w-full mt-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
                    >
                        + 添加字幕
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==================== 字幕样式预览 ====================

interface SubtitleStylePreviewProps {
    preset: SubtitleStylePreset;
    isSelected: boolean;
    onClick: () => void;
}

export function SubtitleStylePreview({ preset, isSelected, onClick }: SubtitleStylePreviewProps) {
    const style = getSubtitleStyle(preset);

    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-lg border-2 transition-all ${
                isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
            }`}
        >
            <div
                className="bg-black rounded p-4 text-center"
                style={{
                    fontFamily: style.fontFamily,
                    fontSize: `${Math.min(style.fontSize, 24)}px`,
                    fontWeight: style.fontWeight,
                    color: style.textColor,
                    textShadow: style.shadowBlur > 0
                        ? `${style.shadowOffset}px ${style.shadowOffset}px ${style.shadowBlur}px ${style.shadowColor}`
                        : 'none',
                    WebkitTextStroke: style.strokeWidth > 0
                        ? `${style.strokeWidth}px ${style.strokeColor}`
                        : 'none',
                    backgroundColor: style.backgroundOpacity > 0
                        ? style.backgroundColor
                        : 'transparent',
                }}
            >
                预览字幕文本
            </div>
            <div className="mt-2 text-sm font-medium text-center">
                {getAllSubtitleStyles().find(s => s.preset === preset)?.name}
            </div>
        </button>
    );
}

// ==================== 快速字幕设置 ====================

interface QuickSubtitleSettingsProps {
    onApply: (preset: SubtitleStylePreset) => void;
}

export function QuickSubtitleSettings({ onApply }: QuickSubtitleSettingsProps) {
    const [selectedPreset, setSelectedPreset] = useState<SubtitleStylePreset>('modern');

    return (
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">字幕样式:</span>
            <select
                value={selectedPreset}
                onChange={(e) => {
                    setSelectedPreset(e.target.value as SubtitleStylePreset);
                    onApply(e.target.value as SubtitleStylePreset);
                }}
                className="px-3 py-2 border rounded-lg"
            >
                {getAllSubtitleStyles().map(style => (
                    <option key={style.preset} value={style.preset}>
                        {style.name} - {style.description}
                    </option>
                ))}
            </select>
        </div>
    );
}
