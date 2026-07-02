import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TimelineEvent } from '@/types/event';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  _forApi?: boolean;
}

interface ChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onEventsGenerated: (events: TimelineEvent[]) => void;
  showToast: (msg: string) => void;
}

export const ChatOverlay = ({ isOpen, onClose, onEventsGenerated, showToast }: ChatOverlayProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', content: '你好，我是川上 AI。说说你今天做了什么，或者有什么计划？我会帮你梳理成清晰的时间线卡片。', _forApi: false }]);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;
    const updated = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(updated);
    setInput('');
    setIsThinking(true);

    try {
      const history = updated.filter(m => m._forApi !== false).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'chat', history }),
      });
      if (r.ok) {
        const data = await r.json() as { reply?: string };
        setMessages([...updated, { role: 'assistant', content: data.reply || '收到，继续说吧。' }]);
      } else {
        throw new Error('proxy ' + r.status);
      }
    } catch {
      setMessages([...updated, { role: 'assistant', content: '抱歉，连接出现问题。请稍后重试。' }]);
    }
    setIsThinking(false);
  };

  const handleExtract = async () => {
    if (messages.length <= 1 || isThinking) return;
    setIsThinking(true);
    try {
      const r = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'extract', history: messages.map(m => ({ role: m.role, content: m.content })) }),
      });
      if (r.ok) {
        const data = await r.json() as { events?: TimelineEvent[] };
        const events = data.events || [];
        if (events.length > 0) {
          onEventsGenerated(events);
          showToast('生成了 ' + events.length + ' 张卡片');
        } else {
          showToast('AI 没有提取到可以沉淀的内容');
        }
      } else {
        throw new Error('proxy ' + r.status);
      }
    } catch {
      showToast('提炼失败，请重试');
    }
    setIsThinking(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] flex flex-col" style={{ background: '#fff' }}>
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
        <h2 className="text-sm font-semibold">AI 对话</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] gap-1 text-muted-foreground"
            onClick={handleExtract}
            disabled={messages.length <= 1 || isThinking}
          >
            <Sparkles size={14} />
            提炼卡片
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                msg.role === 'user'
                  ? 'text-white'
                  : 'text-foreground'
              }`}
              style={{
                background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 text-sm rounded-2xl animate-shimmer" style={{ background: 'hsl(var(--secondary))', borderRadius: '16px 16px 16px 4px' }}>
              ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 底部输入 */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(input); }}
        className="flex items-center gap-2 px-4 py-3 border-t"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <Input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isThinking ? 'AI 思考中...' : '说说你的想法...'}
          disabled={isThinking}
          className="flex-1 text-sm rounded-xl"
        />
        <Button type="submit" disabled={!input.trim() || isThinking} size="icon" className="h-9 w-9 rounded-xl">
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
};
