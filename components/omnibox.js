// ==========================================
// Omnibox — 底部输入栏
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.Omnibox = ({ onSubmitText, isProcessing, onChatOpen }) => {
  const [text, setText] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [voiceOk, setVoiceOk] = React.useState(true);
  const recRef = React.useRef(null);
  const { Ic } = window.Kawa;

  const getRec = () => {
    if (recRef.current) return recRef.current;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceOk(false); return null; }
    const r = new SR(); r.lang = 'zh-CN'; r.interimResults = true; r.continuous = false;
    r.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setText(t); if (e.results[e.results.length - 1].isFinal) { setListening(false); setTimeout(() => { if (t.trim()) { onSubmitText(t.trim()); setText(''); } }, 400); } };
    r.onerror = () => setListening(false); r.onend = () => setListening(false);
    recRef.current = r; return r;
  };
  const toggleVoice = () => { if (listening) { recRef.current?.stop(); return; } const r = getRec(); if (!r) return; try { r.start(); setListening(true); setText(''); } catch { } };
  const submit = e => { e.preventDefault(); if (text.trim() && !isProcessing) { onSubmitText(text.trim()); setText(''); } };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 z-50" style={{ background: 'linear-gradient(to top,rgba(245,240,235,1) 0%,rgba(245,240,235,0.95) 60%,transparent 100%)' }}>
      <form onSubmit={submit} className={'flex items-center gap-2 max-w-lg mx-auto h-11 px-4 glass-light transition-all duration-300 rounded-xl ' + (isProcessing ? 'animate-pulse-glow' : '')}>
        {/* Chat button */}
        <button type="button" onClick={onChatOpen} className="transition-colors" style={{ color: 'var(--text-tertiary)' }} title="AI 对话">
          <Ic.Chat />
        </button>
        <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder={isProcessing ? 'AI 处理中...' : listening ? '聆听中...' : '输入记录 或 "/目标 名称" 创建目标'} disabled={isProcessing} className="flex-1 bg-transparent border-none outline-none text-sm font-light disabled:opacity-30" style={{ color: 'var(--text-primary)' }} />
        {text.trim() ? <button type="submit" disabled={isProcessing} style={{ color: 'var(--text-tertiary)' }}><Ic.Send /></button>
          : voiceOk ? <button type="button" onClick={toggleVoice} style={{ color: listening ? 'var(--color-error)' : 'var(--text-tertiary)' }}><Ic.Mic /></button>
            : null}
      </form>
    </div>
  );
};
