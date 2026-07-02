import { useState, useRef, useCallback } from 'react';
import { Mic } from 'lucide-react';

// SpeechRecognition is not in standard TS DOM types
/* eslint-disable @typescript-eslint/no-explicit-any */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface VoiceButtonProps {
  color: string;
  onResult: (text: string) => void;
}

export const VoiceButton = ({ color, onResult }: VoiceButtonProps) => {
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);
  const recRef = useRef<SpeechRecognition | null>(null);

  const getRec = useCallback((): SpeechRecognition | null => {
    if (recRef.current) return recRef.current;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceOk(false);
      return null;
    }
    const r = new SR();
    r.lang = 'zh-CN';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      if ((e.results[e.results.length - 1] as unknown as { isFinal?: boolean }).isFinal) {
        setListening(false);
        setTimeout(() => {
          if (t.trim()) {
            onResult(t.trim());
          }
        }, 400);
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recRef.current = r;
    return r;
  }, [onResult]);

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = getRec();
    if (!r) return;
    try {
      r.start();
      setListening(true);
    } catch {
      // ignore
    }
  };

  if (!voiceOk) return null;

  return (
    <button
      type="button"
      onClick={toggleVoice}
      style={{ color: listening ? 'hsl(var(--destructive))' : color }}
    >
      <Mic size={16} />
    </button>
  );
};
