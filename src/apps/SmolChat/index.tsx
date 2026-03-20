import { useState } from 'react';
import { Send, Brain, Loader2 } from 'lucide-react';
import { useSmolChat } from '../../hooks/useSmolChat';
import type { AppComponentProps } from '../../types/os';

export default function SmolChat(_props: AppComponentProps) {
  const [input, setInput] = useState('');
  const { messages, thinking, statusText, scrollRef, sendMessage } = useSmolChat();

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text, text);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0e17' }}>
      <div className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Brain size={18} style={{ color: 'var(--os-accent)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>SmolAgent</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,229,204,0.1)', color: 'var(--os-accent)' }}>
          Qwen 72B
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && !thinking && (
          <div className="text-center py-16">
            <Brain size={40} className="mx-auto mb-3" style={{ color: 'var(--os-accent)', opacity: 0.3 }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--os-text)' }}>SmolAgent</p>
            <p className="text-xs" style={{ color: 'var(--os-text-muted)' }}>Qwen 72B via HF Inference API</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{
                background: msg.role === 'user' ? 'rgba(0,229,204,0.12)' : msg.role === 'system' ? 'rgba(255,184,77,0.1)' : 'rgba(255,255,255,0.04)',
                color: msg.role === 'system' ? 'var(--os-yellow)' : 'var(--os-text)',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : undefined,
                borderBottomLeftRadius: msg.role !== 'user' ? '4px' : undefined,
              }}>
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Loader2 size={12} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
              <span className="text-[11px]" style={{ color: 'var(--os-text-muted)' }}>
                {statusText || 'Pensando...'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask SmolAgent..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--os-text-muted)]"
          style={{ color: 'var(--os-text)' }} />
        <button className="p-2 rounded-lg shrink-0 cursor-pointer transition-colors" onClick={handleSend}
          style={{ background: input.trim() ? 'var(--os-accent)' : 'transparent', color: input.trim() ? '#0a0e17' : 'var(--os-text-muted)' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
