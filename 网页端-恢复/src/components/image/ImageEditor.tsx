'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
    Slider, 
    Button, 
    Modal, 
    Select, 
    Space, 
    Upload, 
    message,
    Divider,
    Popover,
    Tooltip
} from 'antd';
import {
    ScissorOutlined,
    BgColorsOutlined,
    FontSizeOutlined,
    PictureOutlined,
    DownloadOutlined,
    UndoOutlined,
    RedoOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    RotateLeftOutlined,
    RotateRightOutlined,
    ColumnWidthOutlined,
    ColumnHeightOutlined,
    ClearOutlined,
    SaveOutlined,
    CloseOutlined,
    CheckOutlined
} from '@ant-design/icons';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// 图片滤镜
const FILTERS = [
    { name: '原图', value: 'none', preview: 'none' },
    { name: '温暖', value: 'warm', css: 'sepia(0.3) saturate(1.2)' },
    { name: '冷色调', value: 'cool', css: 'sepia(0.2) hue-rotate(180deg) saturate(0.8)' },
    { name: '黑白', value: 'grayscale', css: 'grayscale(1)' },
    { name: '复古', value: 'vintage', css: 'sepia(0.4) contrast(1.2) brightness(0.9)' },
    { name: '鲜明', value: 'vivid', css: 'saturate(1.5) contrast(1.1)' },
    { name: '柔焦', value: 'soft', css: 'blur(0.5px) brightness(1.1) saturate(1.1)' },
    { name: '电影感', value: 'cinema', css: 'contrast(1.2) saturate(0.9) brightness(0.9)' },
];

// 滤镜预览组件
function FilterPreview({ filter, imageUrl, isActive, onClick }: { filter: typeof FILTERS[0]; imageUrl: string; isActive: boolean; onClick: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={clsx(
                "cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                isActive ? "border-indigo-500 shadow-lg" : "border-transparent hover:border-zinc-300"
            )}
        >
            <div 
                className="w-16 h-16 bg-zinc-100"
                style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: filter.css || 'none'
                }}
            />
            <div className={clsx(
                "text-xs text-center py-1",
                isActive ? "bg-indigo-500 text-white" : "bg-zinc-100 text-zinc-600"
            )}>
                {filter.name}
            </div>
        </div>
    );
}

// 主编辑器组件
interface ImageEditorProps {
    imageUrl: string;
    onSave?: (editedImage: string, operations: ImageOperations) => void;
    onClose?: () => void;
    visible?: boolean;
}

export interface ImageOperations {
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    filter: string;
    crop?: { x: number; y: number; width: number; height: number };
}

export function ImageEditor({ imageUrl, onSave, onClose, visible = true }: ImageEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [operations, setOperations] = useState<ImageOperations>({
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        filter: 'none'
    });
    const [history, setHistory] = useState<ImageOperations[]>([operations]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [activeTab, setActiveTab] = useState<'filters' | 'adjust' | 'crop'>('filters');
    const [isSaving, setIsSaving] = useState(false);

    // 应用变换到画布
    const applyOperationsToCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;

        img.onload = () => {
            // 应用缩放
            const scaledWidth = img.width * zoom;
            const scaledHeight = img.height * zoom;
            
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;

            // 应用变换
            ctx.save();
            
            // 移动到中心
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            // 旋转
            ctx.rotate((operations.rotation * Math.PI) / 180);
            
            // 翻转
            ctx.scale(operations.scaleX, operations.scaleY);
            
            // 应用滤镜
            ctx.filter = FILTERS.find(f => f.value === operations.filter)?.css || 'none';
            
            // 绘制图片
            ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
            
            ctx.restore();
        };
    }, [imageUrl, operations, zoom]);

    useEffect(() => {
        applyOperationsToCanvas();
    }, [applyOperationsToCanvas]);

    // 添加到历史记录
    const addToHistory = (newOps: ImageOperations) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newOps);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setOperations(newOps);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setOperations(history[historyIndex - 1]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setOperations(history[historyIndex + 1]);
        }
    };

    const handleOperationChange = (key: keyof ImageOperations, value: number | string) => {
        addToHistory({ ...operations, [key]: value });
    };

    const handleFilterChange = (filter: string) => {
        addToHistory({ ...operations, filter });
    };

    const handleSave = async () => {
        setIsSaving(true);
        
        try {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // 创建最终画布
            const finalCanvas = document.createElement('canvas');
            const ctx = finalCanvas.getContext('2d');
            if (!ctx) return;

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;

            await new Promise<void>((resolve) => {
                img.onload = () => {
                    finalCanvas.width = img.width;
                    finalCanvas.height = img.height;
                    
                    ctx.save();
                    ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
                    ctx.rotate((operations.rotation * Math.PI) / 180);
                    ctx.scale(operations.scaleX, operations.scaleY);
                    ctx.filter = FILTERS.find(f => f.value === operations.filter)?.css || 'none';
                    ctx.drawImage(img, -finalCanvas.width / 2, -finalCanvas.height / 2);
                    ctx.restore();
                    
                    resolve();
                };
            });

            // 应用亮度、对比度、饱和度
            const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
            const data = imageData.data;
            
            const brightness = operations.brightness / 100;
            const contrast = operations.contrast / 100;
            const saturation = operations.saturation / 100;

            for (let i = 0; i < data.length; i += 4) {
                // 亮度
                data[i] *= brightness;
                data[i + 1] *= brightness;
                data[i + 2] *= brightness;
                
                // 对比度
                data[i] = ((data[i] / 255 - 0.5) * contrast + 0.5) * 255;
                data[i + 1] = ((data[i + 1] / 255 - 0.5) * contrast + 0.5) * 255;
                data[i + 2] = ((data[i + 2] / 255 - 0.5) * contrast + 0.5) * 255;
                
                // 饱和度
                const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = gray + saturation * (data[i] - gray);
                data[i + 1] = gray + saturation * (data[i + 1] - gray);
                data[i + 2] = gray + saturation * (data[i + 2] - gray);
            }
            
            ctx.putImageData(imageData, 0, 0);

            // 导出为 blob
            const blob = await new Promise<Blob | null>((resolve) => {
                finalCanvas.toBlob((b) => resolve(b), 'image/png');
            });

            if (blob) {
                const url = URL.createObjectURL(blob);
                onSave?.(url, operations);
                message.success('图片保存成功');
            }
        } catch (error) {
            console.error('Save failed:', error);
            message.error('保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `edited-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleReset = () => {
        const defaultOps: ImageOperations = {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            blur: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            filter: 'none'
        };
        addToHistory(defaultOps);
        setZoom(1);
    };

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            footer={null}
            closable={false}
            width={900}
            className="image-editor-modal"
            styles={{ body: { padding: 0 } }}
        >
            <div className="flex h-[600px]">
                {/* 左侧画布区域 */}
                <div className="flex-1 bg-zinc-900 relative overflow-hidden flex items-center justify-center">
                    {/* 工具栏 */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                            <Tooltip title="撤销">
                                <Button 
                                    type="text" 
                                    icon={<UndoOutlined />} 
                                    onClick={handleUndo}
                                    disabled={historyIndex === 0}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <Tooltip title="重做">
                                <Button 
                                    type="text" 
                                    icon={<RedoOutlined />} 
                                    onClick={handleRedo}
                                    disabled={historyIndex === history.length - 1}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <Divider type="vertical" className="!border-zinc-600" />
                            <Tooltip title="放大">
                                <Button 
                                    type="text" 
                                    icon={<ZoomInOutlined />} 
                                    onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <span className="text-white text-sm w-16 text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <Tooltip title="缩小">
                                <Button 
                                    type="text" 
                                    icon={<ZoomOutOutlined />} 
                                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Tooltip title="左旋转">
                                <Button 
                                    type="text" 
                                    icon={<RotateLeftOutlined />} 
                                    onClick={() => handleOperationChange('rotation', operations.rotation - 90)}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <Tooltip title="右旋转">
                                <Button 
                                    type="text" 
                                    icon={<RotateRightOutlined />} 
                                    onClick={() => handleOperationChange('rotation', operations.rotation + 90)}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <Tooltip title="水平翻转">
                                <Button 
                                    type="text" 
                                    icon={<ColumnWidthOutlined />} 
                                    onClick={() => handleOperationChange('scaleX', -operations.scaleX)}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <Tooltip title="垂直翻转">
                                <Button 
                                    type="text" 
                                    icon={<ColumnHeightOutlined />} 
                                    onClick={() => handleOperationChange('scaleY', -operations.scaleY)}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                            <Divider type="vertical" className="!border-zinc-600" />
                            <Tooltip title="重置">
                                <Button 
                                    type="text" 
                                    icon={<ClearOutlined />} 
                                    onClick={handleReset}
                                    className="!text-white hover:!bg-white/10"
                                />
                            </Tooltip>
                        </div>
                    </div>

                    {/* 画布 */}
                    <div 
                        ref={containerRef}
                        className="relative"
                        style={{ transform: `scale(${zoom})` }}
                    >
                        <canvas 
                            ref={canvasRef}
                            className="max-w-full max-h-[500px] object-contain"
                        />
                    </div>
                </div>

                {/* 右侧工具面板 */}
                <div className="w-80 bg-white border-l border-zinc-200 flex flex-col">
                    {/* 标签页切换 */}
                    <div className="flex border-b border-zinc-200">
                        {(['filters', 'adjust', 'crop'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={clsx(
                                    "flex-1 py-3 text-sm font-medium transition-colors",
                                    activeTab === tab 
                                        ? "text-indigo-600 border-b-2 border-indigo-600" 
                                        : "text-zinc-500 hover:text-zinc-700"
                                )}
                            >
                                {tab === 'filters' && '滤镜'}
                                {tab === 'adjust' && '调整'}
                                {tab === 'crop' && '裁剪'}
                            </button>
                        ))}
                    </div>

                    {/* 工具内容 */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <AnimatePresence mode="wait">
                            {activeTab === 'filters' && (
                                <motion.div
                                    key="filters"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="grid grid-cols-4 gap-2">
                                        {FILTERS.map((filter) => (
                                            <FilterPreview
                                                key={filter.value}
                                                filter={filter}
                                                imageUrl={imageUrl}
                                                isActive={operations.filter === filter.value}
                                                onClick={() => handleFilterChange(filter.value)}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'adjust' && (
                                <motion.div
                                    key="adjust"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-600">亮度</span>
                                            <span className="text-zinc-900 font-medium">{operations.brightness}%</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={200}
                                            value={operations.brightness}
                                            onChange={(v) => handleOperationChange('brightness', v)}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-600">对比度</span>
                                            <span className="text-zinc-900 font-medium">{operations.contrast}%</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={200}
                                            value={operations.contrast}
                                            onChange={(v) => handleOperationChange('contrast', v)}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-600">饱和度</span>
                                            <span className="text-zinc-900 font-medium">{operations.saturation}%</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={200}
                                            value={operations.saturation}
                                            onChange={(v) => handleOperationChange('saturation', v)}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-600">模糊</span>
                                            <span className="text-zinc-900 font-medium">{operations.blur}px</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={10}
                                            value={operations.blur}
                                            onChange={(v) => handleOperationChange('blur', v)}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'crop' && (
                                <motion.div
                                    key="crop"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="text-center text-zinc-500 py-8"
                                >
                                    <ScissorOutlined className="text-4xl mb-4 text-zinc-300" />
                                    <p>裁剪功能开发中...</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 底部按钮 */}
                    <div className="p-4 border-t border-zinc-200 flex gap-2">
                        <Button 
                            icon={<CloseOutlined />}
                            onClick={onClose}
                            className="flex-1"
                        >
                            取消
                        </Button>
                        <Button 
                            icon={<DownloadOutlined />}
                            onClick={handleDownload}
                            className="flex-1"
                        >
                            下载
                        </Button>
                        <Button 
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={isSaving}
                            className="flex-1 !bg-indigo-600"
                        >
                            保存
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// 批量下载组件
export function BatchDownload({ images }: { images: Array<{ url: string; name: string }> }) {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleBatchDownload = async () => {
        setDownloading(true);
        setProgress(0);

        for (let i = 0; i < images.length; i++) {
            try {
                const response = await fetch(images[i].url);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = images[i].name || `image-${i + 1}.png`;
                link.click();
                
                URL.revokeObjectURL(url);
                setProgress(((i + 1) / images.length) * 100);
                
                // 延迟一下，避免下载被拦截
                await new Promise(r => setTimeout(r, 200));
            } catch (error) {
                console.error('Download failed:', error);
            }
        }

        setDownloading(false);
        message.success(`成功下载 ${images.length} 张图片`);
    };

    return (
        <div className="text-center">
            <p className="text-zinc-600 mb-4">
                已选择 {images.length} 张图片
            </p>
            <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleBatchDownload}
                loading={downloading}
                className="!bg-indigo-600"
            >
                {downloading ? `下载中 ${Math.round(progress)}%` : '批量下载'}
            </Button>
        </div>
    );
}
