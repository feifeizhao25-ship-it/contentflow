'use client';

import { useEffect, useId, useState } from 'react';
import { joinVoiceText, resolveSpeechSource, voiceLabelsEn, INTL_TTS_ROUTES } from '@/lib/voice-speech';

/**
 * Desktop keeps the draft editor as a panel with a small speaker in the chrome.
 * Narrow screens turn each AI text block into its own card with a thumb-sized speaker.
 * This is not the Flutter card.
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
    <svg aria-hidden="true" viewBox="0 0 24 24" className="voice-glyph" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" />
    </svg>
  );
}

function SpeakerIcon({ stop }: { stop: boolean }) {
  return stop ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="voice-glyph" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="voice-glyph" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
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

export function VoiceMicButton({ onFinal }: { onFinal: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('');
  const label = listening ? voiceLabelsEn.listening : voiceLabelsEn.mic;

  function stop() {
    recognition?.stop();
    recognition = null;
    setListening(false);
  }

  function start() {
    setNote('');
    const host = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition;
    if (!Ctor) {
      setNote(voiceLabelsEn.unsupported);
      return;
    }
    stopSpeech();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      if (text.trim()) onFinal(text);
    };
    rec.onerror = (event) => {
      setNote(event.error === 'not-allowed' ? voiceLabelsEn.denied : voiceLabelsEn.unsupported);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognition = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setNote(voiceLabelsEn.unsupported);
      setListening(false);
    }
  }

  return (
    <span className="voice-control">
      <button type="button" className="voice-mic" aria-pressed={listening} aria-label={label} onClick={() => (listening ? stop() : start())}>
        <MicIcon />
      </button>
      {note ? <span role="status" className="voice-note">{note}</span> : null}
    </span>
  );
}

export function appendVoice(current: string, spoken: string) {
  return joinVoiceText(current, spoken);
}

export function SpeakButton({ text }: { text: string }) {
  const id = useId();
  const playing = useSpeechActive(id);
  const [note, setNote] = useState('');
  const label = playing ? voiceLabelsEn.stop : voiceLabelsEn.speak;

  async function toggle() {
    if (playing) {
      stopSpeech();
      return;
    }
    setNote('');
    stopSpeech();
    const plan = await resolveSpeechSource({
      text,
      language: 'en-US',
      routes: INTL_TTS_ROUTES,
      fetchImpl: (url, init) => fetch(url, init),
      browserAvailable: typeof window.speechSynthesis !== 'undefined',
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
        setNote(voiceLabelsEn.unsupported);
      }
      return;
    }
    if (plan.source === 'browser' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'en-US';
      utterance.onend = () => stopSpeech();
      utterance.onerror = () => {
        stopSpeech();
        setNote(voiceLabelsEn.unsupported);
      };
      setActive(id);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return;
    }
    setNote(voiceLabelsEn.unsupported);
  }

  return (
    <span className="voice-control">
      <button type="button" className="voice-speak" aria-pressed={playing} aria-label={label} disabled={!text.trim()} onClick={() => void toggle()}>
        <SpeakerIcon stop={playing} />
      </button>
      {note ? <span role="status" className="voice-note">{note}</span> : null}
    </span>
  );
}
