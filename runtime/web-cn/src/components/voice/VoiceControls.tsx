'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { CN_TTS_ROUTES, joinVoiceText, resolveSpeechSource, voiceLabelsZh } from '@/lib/voice-speech';

/**
 * 网页自己的语音控件，不照搬手机卡片。
 * 宽屏：麦克风贴在编辑框右侧，喇叭是编辑栏里的小图标。
 * 窄屏：麦克风落到输入框下方（拇指），AI 正文变成卡片，喇叭在卡片右下角。
 */

const listeners = new Set<(id: string | null) => void>();
let activeId: string | null = null;
let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let recognition: { stop: () => void } | null = null;

function setActive(id: string | null) {
  activeId = id;
  listeners.forEach((listener) => listener(id));
}

function stopAudio() {
  if (audio) {
    audio.onended = null;
    audio.pause();
    audio = null;
  }
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

export function stopSpeech() {
  stopAudio();
  setActive(null);
}

function useSpeechActive(id: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const listener = (current: string | null) => setOn(current === id);
    listeners.add(listener);
    setOn(activeId === id);
    return () => {
      listeners.delete(listener);
    };
  }, [id]);
  return on;
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" />
    </svg>
  );
}

function SpeakerIcon({ stop }: { stop: boolean }) {
  return stop ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

function buttonClass(pressed: boolean, kind: 'mic' | 'speak') {
  const size = kind === 'mic' ? 'h-14 w-14 md:h-10 md:w-10' : 'h-12 w-12 md:h-8 md:w-8';
  const tone = pressed ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-zinc-300 bg-white text-zinc-800';
  return `inline-flex shrink-0 items-center justify-center rounded-full border ${size} ${tone}`;
}

export function VoiceField({ children, mic }: { children: ReactNode; mic: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex justify-end">{mic}</div>
    </div>
  );
}

/** 窄屏是一张卡片；宽屏收成编辑器里的一行，不再保留卡片边框。 */
export function VoiceReadout({ children, speak }: { children: ReactNode; speak: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 md:flex-row md:items-start md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-0">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex justify-end">{speak}</div>
    </div>
  );
}

export function VoiceMicButton({ onFinal }: { onFinal: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('');
  const label = listening ? voiceLabelsZh.listening : voiceLabelsZh.mic;

  function stop() {
    recognition?.stop();
    recognition = null;
    setListening(false);
  }

  function start() {
    setNote('');
    const Ctor = typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
        || (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition
      : undefined;
    if (!Ctor) {
      setNote(voiceLabelsZh.unsupported);
      return;
    }
    stopSpeech();
    const rec = new Ctor();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      if (text.trim()) onFinal(text);
    };
    rec.onerror = (event) => {
      setNote(event.error === 'not-allowed' ? voiceLabelsZh.denied : voiceLabelsZh.unsupported);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognition = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setNote(voiceLabelsZh.unsupported);
      setListening(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className={buttonClass(listening, 'mic')} aria-pressed={listening} aria-label={label} onClick={() => (listening ? stop() : start())}>
        <MicIcon />
      </button>
      {note ? <p role="status" className="max-w-48 text-right text-xs text-red-600">{note}</p> : null}
    </div>
  );
}

export function appendVoice(current: string, spoken: string) {
  return joinVoiceText(current, spoken);
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results?: Array<Array<{ transcript?: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function SpeakButton({ text }: { text: string }) {
  const id = useId();
  const playing = useSpeechActive(id);
  const [note, setNote] = useState('');
  const label = playing ? voiceLabelsZh.stop : voiceLabelsZh.speak;
  const empty = !text.trim();

  async function toggle() {
    if (playing) {
      stopSpeech();
      return;
    }
    setNote('');
    stopSpeech();
    const plan = await resolveSpeechSource({
      text,
      language: 'zh-CN',
      routes: CN_TTS_ROUTES,
      fetchImpl: (url, init) => fetch(url, init),
      browserAvailable: typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined',
    });
    if (plan.source === 'tts-route') {
      stopAudio();
      audioUrl = URL.createObjectURL(new Blob([plan.audio], { type: plan.contentType || 'audio/mpeg' }));
      audio = new Audio(audioUrl);
      audio.onended = () => stopSpeech();
      setActive(id);
      try {
        await audio.play();
      } catch {
        stopSpeech();
        setNote(voiceLabelsZh.unsupported);
      }
      return;
    }
    if (plan.source === 'browser' && typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'zh-CN';
      utterance.onend = () => stopSpeech();
      utterance.onerror = () => {
        stopSpeech();
        setNote(voiceLabelsZh.unsupported);
      };
      setActive(id);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return;
    }
    setNote(voiceLabelsZh.unsupported);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className={buttonClass(playing, 'speak')} aria-pressed={playing} aria-label={label} disabled={empty} onClick={() => void toggle()}>
        <SpeakerIcon stop={playing} />
      </button>
      {note ? <p role="status" className="max-w-48 text-right text-xs text-red-600">{note}</p> : null}
    </div>
  );
}
