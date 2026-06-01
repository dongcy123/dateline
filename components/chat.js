// ==========================================
// ChatOverlay — AI 对话浮层
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.ChatOverlay = ({ isOpen, onClose, onEventsGenerated, toast }) => {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [isThinking, setIsThinking] = React.useState(false);
  const [sessionId] = React.useState(() => window.Kawa.uid());
  const bottomRef = React.useRef(null);
  const { Ic } = window.Kawa;

  React.useEffect(() => {
    if (isOpen && messages.length === 0) {
      // 开场白
      setMessages([{ role: 'assistant', content: '你好，我是川上 AI。说说你今天做了什么，或者有什么计划？我会帮你梳理成清晰的时间线卡片。', _forApi: false }]);
    }
  }, [isOpen]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;
    const updated = [...messages, { role: 'user', content: trimmed }];
    setMessages(updated);
    setInput('');
    setIsThinking(true);

    try {
      // 只发 user 消息之后的记录（跳过开头 assistant 欢迎语）
      const history = updated.filter(m => m._forApi !== false).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'chat', history }),
      });
      if (r.ok) {
        const data = await r.json();
        setMessages([...updated, { role: 'assistant', content: data.reply || '收到，继续说吧。' }]);
      } else {
        throw new Error('proxy ' + r.status);
      }
    } catch (e) {
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
        const data = await r.json();
        const events = data.events || [];
        if (events.length > 0) {
          onEventsGenerated(events);
          if (toast) toast('生成了 ' + events.length + ' 张卡片');
        } else {
          if (toast) toast('AI 没有提取到可以沉淀的内容');
        }
      } else {
        throw new Error('proxy ' + r.status);
      }
    } catch (e) {
      if (toast) toast('提炼失败，请重试');
    }
    setIsThinking(false);
    // 保存会话
    window.Kawa.saveChatSession(sessionId, messages, []);
    onClose();
  };

  const handleClose = () => {
    if (messages.length > 1) {
      // 未提炼就关闭 — 也保存会话
      window.Kawa.saveChatSession(sessionId, messages, []);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="flex-1" onClick={handleClose}></div>

      {/* Chat panel */}
      <div className="mx-auto w-full max-w-lg flex flex-col rounded-t-2xl overflow-hidden animate-fade-in" style={{ height: '60%', background: '#fff', border: 'var(--border-card-hover)', borderBottom: 'none' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: 'var(--border-header)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI 对谈</span>
          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <button onClick={handleExtract} disabled={isThinking} className="text-[11px] px-3 py-1 rounded-lg font-medium transition-colors" style={{ background: 'var(--accent-300)', color: '#fff' }}>
                {isThinking ? '提炼中…' : '完成提炼'}
              </button>
            )}
            <button onClick={handleClose} style={{ color: 'var(--text-tertiary)' }}><Ic.Close /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[80%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl ' + (m.role === 'user'
                ? 'text-white rounded-br-md'
                : 'rounded-bl-md')}
                style={m.role === 'user'
                  ? { background: 'var(--accent-400)' }
                  : { background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {m.content}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 text-sm rounded-2xl rounded-bl-md animate-shimmer" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                思考中...
              </div>
            </div>
          )}
          <div ref={bottomRef}></div>
        </div>

        {/* Input */}
        <div className="px-4 py-3" style={{ borderTop: 'var(--border-header)' }}>
          <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder={isThinking ? 'AI 回复中...' : '说点什么...'}
              disabled={isThinking}
              className="flex-1 bg-transparent border-none outline-none text-sm font-light disabled:opacity-30"
              style={{ color: 'var(--text-primary)' }} />
            <button type="submit" disabled={isThinking || !input.trim()} style={{ color: input.trim() ? 'var(--accent-400)' : 'var(--text-tertiary)', opacity: input.trim() ? 1 : 0.4 }}>
              <Ic.Send />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// 对话历史存储
window.Kawa.chatSessions = () => {
  try {
    const raw = localStorage.getItem('kw_chat_sessions');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

window.Kawa.saveChatSession = (id, messages, generatedEventIds) => {
  const sessions = window.Kawa.chatSessions();
  const summary = messages.find(m => m.role === 'user')?.content || '(空)';
  const idx = sessions.findIndex(s => s.id === id);
  const entry = {
    id,
    createdAt: new Date().toISOString(),
    summary: summary.length > 30 ? summary.slice(0, 30) + '…' : summary,
    messageCount: messages.length,
    generatedEvents: generatedEventIds,
  };
  if (idx >= 0) sessions[idx] = entry;
  else sessions.unshift(entry);
  // 只保留最近 50 条
  if (sessions.length > 50) sessions.length = 50;
  try { localStorage.setItem('kw_chat_sessions', JSON.stringify(sessions)); } catch {}
  // 存完整消息
  try { localStorage.setItem('kw_chat_' + id, JSON.stringify(messages)); } catch {}
};

window.Kawa.getChatMessages = (id) => {
  try {
    const raw = localStorage.getItem('kw_chat_' + id);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
