/**
 * Text-to-Speech (TTS) Service
 * AI 配音服务 - 支持多种 TTS 提供商
 */

export type TTSProvider = 'openai' | 'azure' | 'elevenlabs';

export type VoiceGender = 'male' | 'female' | 'neutral';

export interface Voice {
    id: string;
    name: string;
    gender: VoiceGender;
    language: string;
    provider: TTSProvider;
    description?: string;
    sampleUrl?: string;
}

export interface TTSParams {
    text: string;
    voice: string;
    provider?: TTSProvider;
    speed?: number;      // 0.5 - 2.0
    pitch?: number;      // -20 to 20
    emotion?: 'neutral' | 'happy' | 'sad' | 'excited' | 'calm';
    volume?: number;     // 0 - 100
}

export interface TTSResult {
    audioUrl: string;
    duration: number;    // 音频时长（秒）
    characters: number;  // 消耗的字符数
    cost: number;        // 消耗的积分
}

// ==================== 可用声音列表 ====================

// OpenAI TTS 声音
const OPENAI_VOICES: Voice[] = [
    { id: 'alloy', name: 'Alloy', gender: 'neutral', language: '中文/英文', provider: 'openai', description: '中性自然的声音' },
    { id: 'echo', name: 'Echo', gender: 'male', language: '中文/英文', provider: 'openai', description: '低沉的男声' },
    { id: 'fable', name: 'Fable', gender: 'male', language: '中文/英文', provider: 'openai', description: '故事叙述者' },
    { id: 'onyx', name: 'Onyx', gender: 'male', language: '中文/英文', provider: 'openai', description: '专业男声' },
    { id: 'nova', name: 'Nova', gender: 'female', language: '中文/英文', provider: 'openai', description: '活泼女声' },
    { id: 'shimmer', name: 'Shimmer', gender: 'female', language: '中文/英文', provider: 'openai', description: '温柔女声' },
];

// Azure TTS 声音（模拟）
const AZURE_VOICES: Voice[] = [
    { id: 'zh-CN-Xiaoxiao', name: '晓晓', gender: 'female', language: '中文', provider: 'azure', description: '亲切女声' },
    { id: 'zh-CN-Yunxi', name: '云希', gender: 'male', language: '中文', provider: 'azure', description: '磁性男声' },
    { id: 'zh-CN-Yunyang', name: '云扬', gender: 'male', language: '中文', provider: 'azure', description: '新闻男声' },
    { id: 'zh-CN-Xiaohan', name: '晓涵', gender: 'female', language: '中文', provider: 'azure', description: '活泼女声' },
    { id: 'zh-CN-Xiaoxuan', name: '晓璇', gender: 'female', language: '中文', provider: 'azure', description: '温柔女声' },
    { id: 'en-US-Jenny', name: 'Jenny', gender: 'female', language: '英文', provider: 'azure', description: '美式女声' },
    { id: 'en-US-Guy', name: 'Guy', gender: 'male', language: '英文', provider: 'azure', description: '美式男声' },
];

// ElevenLabs 声音（模拟）
const ELEVENLABS_VOICES: Voice[] = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', language: '中文/英文', provider: 'elevenlabs', description: '低沉温暖的女声' },
    { id: '29vD33N6CtxaMQeDbfUL', name: 'Domi', gender: 'female', language: '中文/英文', provider: 'elevenlabs', description: '强势女声' },
    { id: '5Q82tJaLvTdU3LiTqCsY', name: 'Bella', gender: 'female', language: '中文/英文', provider: 'elevenlabs', description: '柔和女声' },
    { id: 'nPczCjzJWyJ9VzN9LkGy', name: 'Antoni', gender: 'male', language: '中文/英文', provider: 'elevenlabs', description: '低沉男声' },
    { id: 'uO3L2N5LpYyTgr0k7Fu', name: 'Adam', gender: 'male', language: '中文/英文', provider: 'elevenlabs', description: '清晰男声' },
    { id: 'wViXP7CGFm8stZ6DaiuC', name: 'Sam', gender: 'male', language: '中文/英文', provider: 'elevenlabs', description: '年轻男声' },
];

// ==================== 价格配置 ====================

const PRICING = {
    openai: { perCharacter: 0.01 },      // 100字符 = 1积分
    azure: { perCharacter: 0.005 },      // 200字符 = 1积分
    elevenlabs: { perCharacter: 0.03 },  // 33字符 = 1积分
};

// ==================== 核心功能 ====================

/**
 * 获取所有可用声音
 */
export function getAllVoices(): Voice[] {
    return [...OPENAI_VOICES, ...AZURE_VOICES, ...ELEVENLABS_VOICES];
}

/**
 * 按提供商获取声音
 */
export function getVoicesByProvider(provider: TTSProvider): Voice[] {
    const voices = {
        openai: OPENAI_VOICES,
        azure: AZURE_VOICES,
        elevenlabs: ELEVENLABS_VOICES,
    };
    return voices[provider] || [];
}

/**
 * 按语言获取声音
 */
export function getVoicesByLanguage(language: string): Voice[] {
    return getAllVoices().filter(v => 
        v.language.toLowerCase().includes(language.toLowerCase())
    );
}

/**
 * 按性别获取声音
 */
export function getVoicesByGender(gender: VoiceGender): Voice[] {
    return getAllVoices().filter(v => v.gender === gender);
}

/**
 * 生成配音
 */
export async function generateSpeech(params: TTSParams): Promise<TTSResult> {
    const { text, voice, provider = 'openai', speed = 1.0, pitch = 0, emotion } = params;

    if (!text.trim()) {
        throw new Error('Text is empty');
    }

    const characters = text.length;
    const pricing = PRICING[provider];
    const cost = Math.ceil(characters * pricing.perCharacter);

    try {
        let audioUrl: string;

        switch (provider) {
            case 'openai':
                audioUrl = await generateWithOpenAI(text, voice, speed, pitch);
                break;
            case 'azure':
                audioUrl = await generateWithAzure(text, voice, speed, pitch);
                break;
            case 'elevenlabs':
                audioUrl = await generateWithElevenLabs(text, voice, speed, emotion);
                break;
            default:
                audioUrl = await generateWithOpenAI(text, voice, speed, pitch);
        }

        // 估算音频时长（假设平均 3 字符/秒）
        const duration = Math.ceil(characters / (3 * speed));

        return {
            audioUrl,
            duration,
            characters,
            cost,
        };
    } catch (error) {
        console.error('TTS generation error:', error);
        throw error;
    }
}

/**
 * OpenAI TTS 生成
 */
async function generateWithOpenAI(
    text: string,
    voice: string,
    speed: number,
    pitch: number
): Promise<string> {
    // 实际调用 OpenAI API
    const response = await fetch('/api/ai/tts/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'tts-1',
            voice,
            input: text,
            speed: speed,
        }),
    });

    if (!response.ok) {
        throw new Error('OpenAI TTS failed');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

/**
 * Azure TTS 生成
 */
async function generateWithAzure(
    text: string,
    voice: string,
    speed: number,
    pitch: number
): Promise<string> {
    const response = await fetch('/api/ai/tts/azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            voice,
            text,
            rate: `${(speed - 1) * 100}%`,
            pitch: pitch > 0 ? `+${pitch}%` : `${pitch}%`,
        }),
    });

    if (!response.ok) {
        throw new Error('Azure TTS failed');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

/**
 * ElevenLabs TTS 生成
 */
async function generateWithElevenLabs(
    text: string,
    voiceId: string,
    speed: number,
    emotion?: string
): Promise<string> {
    const response = await fetch('/api/ai/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            voice_id: voiceId,
            text,
            speed: speed,
            emotion: emotion,
        }),
    });

    if (!response.ok) {
        throw new Error('ElevenLabs TTS failed');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

/**
 * 从脚本生成配音（带字幕）
 */
export interface ScriptVoiceover {
    sceneId: string;
    text: string;
    voice: string;
    audioUrl?: string;
    duration?: number;
    status: 'pending' | 'generating' | 'completed' | 'failed';
}

export async function generateVoiceoversForScript(
    scenes: { id: string; subtitle: string }[],
    voice: string,
    provider: TTSProvider,
    onProgress?: (progress: number, status: string) => void
): Promise<ScriptVoiceover[]> {
    const results: ScriptVoiceover[] = [];
    const total = scenes.length;

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        onProgress?.((i / total) * 100, `Generating voiceover for scene ${i + 1}/${total}`);

        try {
            const result = await generateSpeech({
                text: scene.subtitle,
                voice,
                provider,
            });

            results.push({
                sceneId: scene.id,
                text: scene.subtitle,
                voice,
                audioUrl: result.audioUrl,
                duration: result.duration,
                status: 'completed',
            });
        } catch (error) {
            results.push({
                sceneId: scene.id,
                text: scene.subtitle,
                voice,
                status: 'failed',
            });
        }
    }

    onProgress?.(100, 'Voiceover generation completed');
    return results;
}

/**
 * 计算配音积分消耗
 */
export function calculateTTSCost(
    text: string,
    provider: TTSProvider = 'openai'
): number {
    const characters = text.length;
    const pricing = PRICING[provider];
    return Math.ceil(characters * pricing.perCharacter);
}

/**
 * 预估配音时长
 */
export function estimateVoiceoverDuration(
    text: string,
    speed: number = 1.0
): number {
    // 平均 3 字符/秒，中文约 4-5 字符/秒
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    const chineseDuration = chineseChars / (4 * speed);
    const otherDuration = otherChars / (3 * speed);
    
    return Math.ceil(chineseDuration + otherDuration);
}

/**
 * 获取提供商建议
 */
export function getProviderRecommendation(
    language: string,
    budget: 'low' | 'medium' | 'high' = 'medium'
): TTSProvider {
    if (budget === 'low') return 'azure';
    if (budget === 'high') return 'elevenlabs';
    return 'openai';
}

/**
 * 声音预览（获取示例音频）
 */
export function getVoicePreviewUrl(voiceId: string, provider: TTSProvider): string {
    // 返回预设的示例音频 URL
    return `/api/ai/tts/preview?voice=${voiceId}&provider=${provider}`;
}

// ==================== 导出 ====================

export const ttsService = {
    getAllVoices,
    getVoicesByProvider,
    getVoicesByLanguage,
    getVoicesByGender,
    generate: generateSpeech,
    generateForScript: generateVoiceoversForScript,
    calculateCost: calculateTTSCost,
    estimateDuration: estimateVoiceoverDuration,
    getProviderRecommendation,
    getPreviewUrl: getVoicePreviewUrl,
    voices: {
        openai: OPENAI_VOICES,
        azure: AZURE_VOICES,
        elevenlabs: ELEVENLABS_VOICES,
    },
    pricing: PRICING,
};

export default ttsService;
