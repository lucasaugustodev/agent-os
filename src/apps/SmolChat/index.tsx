import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: string[];
}

export default function SmolChatApp(_props: AppComponentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [statusText, setStatusText] = useState('');
  const [active, setActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, active]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || active) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setActive(true);
    setStatusText('Processando...');

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, stream: true }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'status') {
              setStatusText(evt.text ?? 'Processando...');
            } else if (evt.type === 'tool_call') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), evt.name ?? 'tool'] }
                    : m
                )
              );
            } else if (evt.type === 'delta' || evt.type === 'content') {
              fullContent += evt.delta ?? evt.content ?? '';
              const cap = fullContent;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: cap } : m))
              );
            } else if (evt.type === 'done' || evt.type === 'finish') {
              if (evt.content) {
                fullContent = evt.content;
                const cap = fullContent;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: cap } : m))
                );
              }
            }
          } catch {
            if (raw && raw !== '[DONE]') {
              fullContent += raw;
              const cap = fullContent;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: cap } : m))
              );
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Erro: ' + msg } : m
        )
      );
    } finally {
      setActive(false);
      setStatusText('');
    }
  }, [input, active]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0e17', color: '#e0e0e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid #1a2332', background: '#0d1420' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#00e5cc22,#00e5cc44)', border: '1px solid #00e5cc44' }}>
            <Bot size={14} style={{ color: '#00e5cc' }} />
          </div>
          <span className="font-semibold text-sm">Agent OS</span>
        </div>
        <span className="text-xs" style={{ color: '#4a6080' }}>Llama 70B + Claude</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#00e5cc22,#00e5cc44)', border: '1px solid #00e5cc44' }}>
              <Bot size={22} style={{ color: '#00e5cc' }} />
            </div>
            <p className="text-sm" style={{ color: '#4a6080' }}>Como posso ajudar?</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}
            className={'flex gap-3 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: '#00e5cc22', border: '1px solid #00e5cc44' }}>
                <Bot size={12} style={{ color: '#00e5cc' }} />
              </div>
            )}
            <div className="max-w-[80%] space-y-1">
              {(msg.toolCalls ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(msg.toolCalls ?? []).map((tc, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: '#1a2332', color: '#00e5cc', border: '1px solid #00e5cc33' }}>
                      {tc}
                    </span>
                  ))}
                </div>
              )}
              <div className="px-3 py-2 rounded-xl text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user' ? '#00e5cc20' : '#111928',
                  border: '1px solid ' + (msg.role === 'user' ? '#00e5cc44' : '#1a2332'),
                  whiteSpace: 'pre-wrap',
                  userSelect: 'text',
                }}>
                {msg.content || (msg.role === 'assistant' && active ? '...' : '')}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: '#1a2332', border: '1px solid #2a3444' }}>
                <User size={12} style={{ color: '#e0e0e0' }} />
              </div>
            )}
          </div>
        ))}
        {active && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit"
            style={{ background: '#111928', border: '1px solid #1a2332' }}>
            <Loader2 size={12} className="animate-spin" style={{ color: '#00e5cc' }} />
            <span className="text-xs" style={{ color: '#4a6080' }}>{statusText}</span>
          </div>
        )}
        
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid #1a2332', background: '#0d1420' }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: '#111928', border: '1px solid #1a2332' }}>
          <textarea ref={inputRef} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte ao Agent OS..."
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
            style={{ color: '#e0e0e0', maxHeight: '120px', userSelect: 'text' }}
          />
          <button onClick={sendMessage}
            disabled={!input.trim() || active}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: input.trim() && !active ? '#00e5cc' : '#1a2332',
              opacity: input.trim() && !active ? 1 : 0.4,
            }}>
            <Send size={13} style={{ color: input.trim() && !active ? '#0a0e17' : '#4a6080' }} />
          </button>
        </div>
        <p className="text-xs mt-1.5 text-center" style={{ color: '#2a3444' }}>
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
