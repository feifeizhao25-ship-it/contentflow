/**
 * Subtitle Service
 * 字幕生成服务 - 支持多种字幕格式和渲染方式
 */

export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'lrc';

export type SubtitlePosition = 'bottom' | 'top' | 'middle' | 'custom';

export type SubtitleStylePreset = 
    | 'default'      // 默认
    | 'modern'       // 现代简洁
    | 'cinematic'    // 电影风格
    | 'vibrant'      // 鲜艳活泼
    | 'elegant'      // 优雅优雅
    | 'retro'        // 复古风格
    | 'neon'         // 霓虹灯效
    | 'minimal'      // 极简风格
    | 'subtitle_zh'  // 中文弹幕
    | 'tiktok'       // TikTok 风格
    | 'youtube'      // YouTube 风格
    | 'news'         // 新闻风格';

// 字幕条目
export interface SubtitleItem {
    id: string;
    startTime: number;      // 开始时间（秒）
    endTime: number;        // 结束时间（秒）
    text: string;           // 字幕文本
    speaker?: string;       // 说话人（多角色时使用）
    position?: SubtitlePosition;
}

// 字幕样式配置
export interface SubtitleStyle {
    preset: SubtitleStylePreset;
    fontFamily: string;
    fontSize: number;       // 字体大小（像素）
    fontWeight: number;
    textColor: string;      // 文字颜色
    backgroundColor?: string;
    backgroundOpacity: number;
    strokeColor: string;
    strokeWidth: number;
    shadowColor: string;
    shadowOffset: number;
    shadowBlur: number;
    position: SubtitlePosition;
    positionX?: number;     // 自定义 X 坐标
    positionY?: number;     // 自定义 Y 坐标
    margin: number;
    lineSpacing: number;
    letterSpacing: number;
    alignment: 'left' | 'center' | 'right';
    animation?: 'none' | 'fade' | 'slide' | 'typewriter';
    animationDuration: number;
}

// 字幕生成参数
export interface SubtitleGenerateParams {
    script: string;         // 完整脚本
    duration: number;       // 视频总时长（秒）
    language?: string;      // 语言
    voiceover?: {           // 如果有配音，自动对齐
        audioUrl: string;
        segments: { start: number; end: number; text: string }[];
    };
}

// 字幕渲染参数
export interface SubtitleRenderParams {
    subtitles: SubtitleItem[];
    style: SubtitleStyle;
    videoWidth: number;
    videoHeight: number;
    outputPath?: string;
}

// ==================== 预设样式 ====================

const SUBTITLE_STYLES: Record<SubtitleStylePreset, Omit<SubtitleStyle, 'preset'>> = {
    default: {
        fontFamily: 'System UI',
        fontSize: 24,
        fontWeight: 500,
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 0.3,
        strokeColor: '#000000',
        strokeWidth: 1,
        shadowColor: '#000000',
        shadowOffset: 1,
        shadowBlur: 2,
        position: 'bottom',
        margin: 20,
        lineSpacing: 1.2,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.3,
    },
    modern: {
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: 28,
        fontWeight: 600,
        textColor: '#FFFFFF',
        backgroundColor: '#1A1A2E',
        backgroundOpacity: 0.5,
        strokeColor: '#FFFFFF',
        strokeWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: 0,
        shadowBlur: 10,
        position: 'bottom',
        margin: 30,
        lineSpacing: 1.4,
        letterSpacing: 1,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.2,
    },
    cinematic: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fontWeight: 400,
        textColor: '#F5F5F5',
        backgroundColor: '#000000',
        backgroundOpacity: 0.6,
        strokeColor: '#000000',
        strokeWidth: 2,
        shadowColor: '#000000',
        shadowOffset: 2,
        shadowBlur: 4,
        position: 'bottom',
        margin: 40,
        lineSpacing: 1.3,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.5,
    },
    vibrant: {
        fontFamily: 'PingFang SC Bold, sans-serif',
        fontSize: 32,
        fontWeight: 700,
        textColor: '#FFD700',
        backgroundColor: '#FF6B35',
        backgroundOpacity: 0.8,
        strokeColor: '#FFFFFF',
        strokeWidth: 3,
        shadowColor: '#FF6B35',
        shadowOffset: 3,
        shadowBlur: 8,
        position: 'bottom',
        margin: 25,
        lineSpacing: 1.2,
        letterSpacing: 2,
        alignment: 'center',
        animation: 'slide',
        animationDuration: 0.3,
    },
    elegant: {
        fontFamily: 'Georgia, serif',
        fontSize: 26,
        fontWeight: 400,
        textColor: '#F8F8FF',
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        strokeColor: '#333333',
        strokeWidth: 1,
        shadowColor: 'rgba(0,0,0,0.5)',
        shadowOffset: 1,
        shadowBlur: 3,
        position: 'bottom',
        margin: 35,
        lineSpacing: 1.5,
        letterSpacing: 1,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.4,
    },
    retro: {
        fontFamily: 'Courier New, monospace',
        fontSize: 24,
        fontWeight: 600,
        textColor: '#FFD700',
        backgroundColor: '#8B0000',
        backgroundOpacity: 0.7,
        strokeColor: '#000000',
        strokeWidth: 2,
        shadowColor: '#FFD700',
        shadowOffset: 2,
        shadowBlur: 0,
        position: 'bottom',
        margin: 20,
        lineSpacing: 1.3,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'typewriter',
        animationDuration: 0.1,
    },
    neon: {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: 30,
        fontWeight: 900,
        textColor: '#00FFFF',
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        strokeColor: '#FF00FF',
        strokeWidth: 4,
        shadowColor: '#00FFFF',
        shadowOffset: 0,
        shadowBlur: 15,
        position: 'bottom',
        margin: 25,
        lineSpacing: 1.2,
        letterSpacing: 3,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.2,
    },
    minimal: {
        fontFamily: 'System UI Light',
        fontSize: 22,
        fontWeight: 300,
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        strokeColor: 'transparent',
        strokeWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: 0,
        shadowBlur: 0,
        position: 'bottom',
        margin: 30,
        lineSpacing: 1.4,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'none',
        animationDuration: 0,
    },
    subtitle_zh: {
        fontFamily: 'Microsoft YaHei, PingFang SC',
        fontSize: 26,
        fontWeight: 500,
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 0.4,
        strokeColor: '#000000',
        strokeWidth: 1,
        shadowColor: '#000000',
        shadowOffset: 1,
        shadowBlur: 2,
        position: 'bottom',
        margin: 20,
        lineSpacing: 1.3,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.2,
    },
    tiktok: {
        fontFamily: 'Proxima Nova, System UI',
        fontSize: 28,
        fontWeight: 700,
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 0.5,
        strokeColor: '#FE2C55',
        strokeWidth: 2,
        shadowColor: 'transparent',
        shadowOffset: 0,
        shadowBlur: 0,
        position: 'bottom',
        margin: 40,
        lineSpacing: 1.2,
        letterSpacing: 0.5,
        alignment: 'center',
        animation: 'slide',
        animationDuration: 0.25,
    },
    youtube: {
        fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: 24,
        fontWeight: 500,
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 0.6,
        strokeColor: '#000000',
        strokeWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: 0,
        shadowBlur: 0,
        position: 'bottom',
        margin: 20,
        lineSpacing: 1.3,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'fade',
        animationDuration: 0.2,
    },
    news: {
        fontFamily: 'Arial Bold, sans-serif',
        fontSize: 32,
        fontWeight: 700,
        textColor: '#FFFFFF',
        backgroundColor: '#0066CC',
        backgroundOpacity: 0.85,
        strokeColor: '#FFFFFF',
        strokeWidth: 1,
        shadowColor: '#000000',
        shadowOffset: 2,
        shadowBlur: 2,
        position: 'top',
        margin: 20,
        lineSpacing: 1.2,
        letterSpacing: 0,
        alignment: 'center',
        animation: 'none',
        animationDuration: 0,
    },
};

// ==================== 核心功能 ====================

/**
 * 从脚本生成字幕
 */
export function generateSubtitlesFromScript(
    script: string,
    duration: number,
    language: string = 'zh-CN'
): SubtitleItem[] {
    const subtitles: SubtitleItem[] = [];
    
    // 按句子分割
    const sentences = splitIntoSentences(script, language);
    
    // 计算每句的时间
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
    const charsPerSecond = totalChars / duration;
    
    let currentTime = 0;
    
    for (let i = 0; i < sentences.length; i++) {
        const text = sentences[i].trim();
        if (!text) continue;
        
        const charCount = text.length;
        const itemDuration = Math.max(1.5, charCount / charsPerSecond); // 最少1.5秒
        
        subtitles.push({
            id: `subtitle-${i + 1}`,
            startTime: currentTime,
            endTime: Math.min(currentTime + itemDuration, duration),
            text: text,
        });
        
        currentTime += itemDuration;
        
        // 添加短暂间隔
        if (i < sentences.length - 1) {
            currentTime += 0.2;
        }
    }
    
    return subtitles;
}

/**
 * 根据配音自动对齐字幕
 */
export function generateSubtitlesFromVoiceover(
    segments: { start: number; end: number; text: string }[]
): SubtitleItem[] {
    return segments.map((segment, index) => ({
        id: `subtitle-${index + 1}`,
        startTime: segment.start,
        endTime: segment.end,
        text: segment.text,
    }));
}

/**
 * 从音频文件识别字幕（使用 Whisper）
 */
export async function generateSubtitlesFromAudio(
    audioUrl: string,
    language?: string
): Promise<SubtitleItem[]> {
    const response = await fetch('/api/ai/subtitle/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            audio_url: audioUrl,
            language: language,
            format: 'verbose_json', // 获取时间戳
        }),
    });
    
    if (!response.ok) {
        throw new Error('Failed to generate subtitles from audio');
    }
    
    const result = await response.json();
    
    return result.segments.map((seg: any, index: number) => ({
        id: `subtitle-${index + 1}`,
        startTime: seg.start,
        endTime: seg.end,
        text: seg.text.trim(),
    }));
}

/**
 * 分割句子
 */
function splitIntoSentences(text: string, language: string): string[] {
    if (language.startsWith('zh')) {
        // 中文：按句号、问号、感叹号分割
        return text
            .replace(/([。！？])\s*/g, '$1|')
            .split('|')
            .filter(s => s.trim());
    } else {
        // 英文：按句号、问号、感叹号分割
        return text
            .replace(/([.!?])\s*/g, '$1|')
            .split('|')
            .filter(s => s.trim());
    }
}

/**
 * 导出字幕为指定格式
 */
export function exportSubtitles(
    subtitles: SubtitleItem[],
    format: SubtitleFormat
): string {
    switch (format) {
        case 'srt':
            return exportAsSRT(subtitles);
        case 'vtt':
            return exportAsVTT(subtitles);
        case 'ass':
            return exportAsASS(subtitles, {});
        case 'lrc':
            return exportAsLRC(subtitles);
        default:
            return exportAsSRT(subtitles);
    }
}

/**
 * 导出为 SRT 格式
 */
function exportAsSRT(subtitles: SubtitleItem[]): string {
    return subtitles.map((item, index) => {
        const start = formatTimeSRT(item.startTime);
        const end = formatTimeSRT(item.endTime);
        return `${index + 1}\n${start} --> ${end}\n${item.text}\n`;
    }).join('\n');
}

/**
 * 导出为 VTT 格式
 */
function exportAsVTT(subtitles: SubtitleItem[]): string {
    let vtt = 'WEBVTT\n\n';
    vtt += subtitles.map((item, index) => {
        const start = formatTimeVTT(item.startTime);
        const end = formatTimeVTT(item.endTime);
        return `${index + 1}\n${start} --> ${end}\n${item.text}\n`;
    }).join('\n');
    return vtt;
}

/**
 * 导出为 ASS 格式
 */
function exportAsASS(subtitles: SubtitleItem[], style: Partial<SubtitleStyle>): string {
    const events = subtitles.map(item => {
        const start = formatTimeASS(item.startTime);
        const end = formatTimeASS(item.endTime);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${item.text}`;
    }).join('\n');
    
    return `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}`;
}

/**
 * 导出为 LRC 格式
 */
function exportAsLRC(subtitles: SubtitleItem[]): string {
    return subtitles.map(item => {
        const time = formatTimeLRC(item.startTime);
        return `${time}${item.text}`;
    }).join('\n');
}

/**
 * 时间格式化
 */
function formatTimeSRT(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatTimeVTT(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function formatTimeASS(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
}

function formatTimeLRC(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `[${pad(m)}:${pad(s)}]`;
}

function pad(num: number, size: number = 2): string {
    return num.toString().padStart(size, '0');
}

/**
 * 获取预设样式
 */
export function getSubtitleStyle(preset: SubtitleStylePreset): SubtitleStyle {
    return {
        preset,
        ...SUBTITLE_STYLES[preset],
    };
}

/**
 * 获取所有可用样式
 */
export function getAllSubtitleStyles(): { preset: SubtitleStylePreset; name: string; description: string }[] {
    return [
        { preset: 'default', name: '默认', description: '标准字幕样式' },
        { preset: 'modern', name: '现代', description: '简洁现代的设计' },
        { preset: 'cinematic', name: '电影', description: '电影字幕风格' },
        { preset: 'vibrant', name: '鲜艳', description: '活泼醒目的颜色' },
        { preset: 'elegant', name: '优雅', description: '优雅的衬线字体' },
        { preset: 'retro', name: '复古', description: '复古打字机风格' },
        { preset: 'neon', name: '霓虹', description: '发光霓虹效果' },
        { preset: 'minimal', name: '极简', description: '简单干净的设计' },
        { preset: 'subtitle_zh', name: '中文弹幕', description: '适合中文视频' },
        { preset: 'tiktok', name: 'TikTok', description: '短视频风格' },
        { preset: 'youtube', name: 'YouTube', description: 'YouTube 风格' },
        { preset: 'news', name: '新闻', description: '新闻标题样式' },
    ];
}

/**
 * 合并字幕（重叠时智能合并）
 */
export function mergeSubtitles(subtitles: SubtitleItem[]): SubtitleItem[] {
    if (subtitles.length === 0) return [];
    
    const merged: SubtitleItem[] = [subtitles[0]];
    
    for (let i = 1; i < subtitles.length; i++) {
        const current = subtitles[i];
        const last = merged[merged.length - 1];
        
        if (current.startTime < last.endTime) {
            // 有重叠，合并
            last.endTime = Math.max(last.endTime, current.endTime);
            last.text += '\n' + current.text;
        } else {
            merged.push(current);
        }
    }
    
    return merged;
}

/**
 * 调整字幕时间偏移
 */
export function adjustSubtitleTiming(
    subtitles: SubtitleItem[],
    offset: number
): SubtitleItem[] {
    return subtitles.map(item => ({
        ...item,
        startTime: Math.max(0, item.startTime + offset),
        endTime: Math.max(0, item.endTime + offset),
    }));
}

/**
 * 过滤字幕（只保留指定时间范围内的）
 */
export function filterSubtitles(
    subtitles: SubtitleItem[],
    startTime: number,
    endTime: number
): SubtitleItem[] {
    return subtitles.filter(
        item => item.endTime > startTime && item.startTime < endTime
    );
}

/**
 * 计算字幕总时长
 */
export function calculateSubtitleDuration(subtitles: SubtitleItem[]): number {
    if (subtitles.length === 0) return 0;
    const last = subtitles[subtitles.length - 1];
    return last.endTime;
}

/**
 * 估算字幕生成积分消耗
 */
export function calculateSubtitleCost(
    subtitles: SubtitleItem[],
    useAI: boolean = false
): number {
    // 基础生成免费
    if (!useAI) return 0;
    
    // AI 识别（Whisper）按分钟计费
    const totalDuration = calculateSubtitleDuration(subtitles);
    const minutes = Math.ceil(totalDuration / 60);
    return minutes * 2; // 2积分/分钟
}

// ==================== 导出 ====================

export const subtitleService = {
    generateFromScript: generateSubtitlesFromScript,
    generateFromVoiceover: generateSubtitlesFromVoiceover,
    generateFromAudio: generateSubtitlesFromAudio,
    export: exportSubtitles,
    getStyle: getSubtitleStyle,
    getAllStyles: getAllSubtitleStyles,
    merge: mergeSubtitles,
    adjustTiming: adjustSubtitleTiming,
    filter: filterSubtitles,
    calculateDuration: calculateSubtitleDuration,
    calculateCost: calculateSubtitleCost,
};

export default subtitleService;
