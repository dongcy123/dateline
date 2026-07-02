import { useState, useRef } from 'react';
import { Send, MessageCircle, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceButton } from './VoiceButton';

interface OmniboxProps {
  onSubmitText: (text: string) => void;
  isProcessing: boolean;
  onChatOpen?: () => void;
  onImageSubmit?: (imageUrl: string, caption: string | null) => void;
}

export const Omnibox = ({ onSubmitText, isProcessing, onChatOpen, onImageSubmit }: OmniboxProps) => {
  const [text, setText] = useState('');
  const [imgUploading, setImgUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      onSubmitText(text.trim());
      setText('');
    }
  };

  const handleVoiceResult = (voiceText: string) => {
    setText(voiceText);
    setTimeout(() => {
      if (voiceText.trim()) {
        onSubmitText(voiceText.trim());
        setText('');
      }
    }, 400);
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('图片不能超过 10MB');
      return;
    }

    setImgUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const r = await fetch('/api/proxy', {
        method: 'POST',
        body: formData,
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err?.error?.message || '上传失败');
      }

      const data = await r.json() as { url?: string };
      if (data.url && onImageSubmit) {
        onImageSubmit(data.url, text.trim() || null);
        setText('');
      }
    } catch (err: unknown) {
      alert('上传失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
    setImgUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const isLoading = isProcessing || imgUploading;
  const placeholder = imgUploading ? '上传图片中...'
    : isProcessing ? 'AI 处理中...'
    : '输入记录 或 "/目标 名称" 创建目标';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 p-4 pb-8 z-50"
      style={{ background: 'linear-gradient(to top,rgba(245,245,245,1) 0%,rgba(245,245,245,0.95) 60%,transparent 100%)' }}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

      <form
        onSubmit={submit}
        className={`flex items-center gap-2 max-w-lg mx-auto h-11 px-4 glass-light transition-all duration-300 rounded-xl ${isProcessing ? 'animate-pulse-glow' : ''}`}
      >
        {/* AI 对话按钮 */}
        {onChatOpen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onChatOpen}
            disabled={isLoading}
            title="AI 对话"
          >
            <MessageCircle size={16} />
          </Button>
        )}

        {/* 图片上传按钮 */}
        {onImageSubmit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${imgUploading ? 'animate-shimmer' : ''}`}
            style={{ color: imgUploading ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            title="上传图片"
          >
            <Image size={16} />
          </Button>
        )}

        <Input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 bg-transparent border-0 border-transparent ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm font-light disabled:opacity-30 shadow-none rounded-none"
          style={{ boxShadow: 'none' }}
        />
        {text.trim() ? (
          <Button
            type="submit"
            disabled={isProcessing}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
          >
            <Send size={16} />
          </Button>
        ) : (
          <VoiceButton color="hsl(var(--muted-foreground))" onResult={handleVoiceResult} />
        )}
      </form>
    </div>
  );
};
