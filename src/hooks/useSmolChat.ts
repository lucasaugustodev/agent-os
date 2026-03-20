import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'status';
  text: string;
}

export function useSmolChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, statusText]);

  async function send(prompt: string) {
    setThinking(true);
    setStatusText('Pensando...');

    try {
      const res = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, stream: true }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          try {
            const evt = JSON.parse(raw);
            if (evt.event === 'status') {
              setStatusText(evt.text || 'Pensando...');
            } else if (evt.event === 'tool_call') {
              setStatusText(`⚡ ${evt.tool}: ${evt.args?.substring(0, 60)}...`);
            } else if (evt.event === 'tool_result') {
              setStatusText(`✓ ${evt.tool} concluído`);
            } else if (evt.event === 'done') {
              finalResult = evt.result || '';
            }
          } catch {}
        }
      }

      if (finalResult) {
        setMessages(prev => [...prev, { role: 'assistant', text: finalResult }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: 'Erro de conexão.' }]);
    }

    setThinking(false);
    setStatusText('');
  }

  function sendMessage(userText: string, contextPrompt: string) {
    if (!userText.trim() || thinking) return;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    send(contextPrompt);
  }

  return { messages, thinking, statusText, scrollRef, sendMessage };
}
