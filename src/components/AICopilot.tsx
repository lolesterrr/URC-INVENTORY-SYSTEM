/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, Cpu, Sparkles, AlertCircle, Trash2, HelpCircle } from 'lucide-react';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: `Hello! I am the **URC IT Intelligent Copilot**. I can analyze your Uganda Railways IT inventory and assist with:
- **Procurement Logistics**: Recommend exact spare parts to order based on current stock thresholds.
- **Contract Expiration Tracker**: Analyze software seat allocations, renewal costs, and upcoming expiries.
- **Preventative Maintenance**: Suggest diagnostic cycles for server room switches, CPU cores, or field laptops.

How can I support Uganda Railways IT operations today?`
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || userInput;
    if (!promptToSend.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: promptToSend }]);
    if (!customPrompt) {
      setUserInput('');
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSend })
      });
      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { sender: 'assistant', text: data.reply }]);
      } else if (data.error) {
        setErrorMsg(data.error);
        setMessages(prev => [...prev, { sender: 'assistant', text: `An error occurred: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { sender: 'assistant', text: 'AI Server returned an invalid response. Try again.' }]);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setMessages(prev => [...prev, { sender: 'assistant', text: `Failed to connect to the server: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        sender: 'assistant',
        text: 'System cleared. Ask me anything about URC IT hardware assets, software, or datacenter parts.'
      }
    ]);
    setErrorMsg(null);
  };

  // Safe and robust regex-based Markdown text renderer to handle bold (**), bullet points (-), and headings (###) without extra packages
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      let elementKey = `line-${idx}`;

      // Handle main title headers
      if (line.startsWith('### ')) {
        const pureText = line.replace('### ', '');
        return <h4 key={elementKey} className="text-xs font-bold text-slate-800 mt-3 mb-1.5 border-b border-slate-100 pb-1">{pureText}</h4>;
      }
      if (line.startsWith('## ')) {
        const pureText = line.replace('## ', '');
        return <h4 key={elementKey} className="text-sm font-bold text-slate-900 mt-4 mb-2">{pureText}</h4>;
      }

      // Handle standard lists
      let isListItem = false;
      if (line.startsWith('- ') || line.startsWith('* ')) {
        content = line.substring(2);
        isListItem = true;
      }

      // Parse bolding (**word**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIdx = 0;
      let match;

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIdx) {
          parts.push(content.substring(lastIdx, match.index));
        }
        parts.push(<strong key={`bold-${match.index}`} className="font-bold text-slate-900">{match[1]}</strong>);
        lastIdx = boldRegex.lastIndex;
      }
      
      if (lastIdx < content.length) {
        parts.push(content.substring(lastIdx));
      }

      const formattedLine = parts.length > 0 ? parts : content;

      if (isListItem) {
        return (
          <li key={elementKey} className="list-disc ml-5 mt-1 text-slate-600 pl-1">
            {formattedLine}
          </li>
        );
      }

      return <p key={elementKey} className="mt-1 leading-relaxed text-slate-600">{formattedLine}</p>;
    });
  };

  const quickPrompts = [
    'Recommend exact spare storage parts to order based on reorder levels.',
    'Formulate a preventive maintenance schedule for Nalukolongo workshop computers.',
    'Analyze Oracle license status and recommend cost mitigation.',
    'Generate a hardware audit summary of Kampala Headquarters assets.'
  ];

  return (
    <div className="space-y-4">
      
      {/* Header Panel */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="bg-yellow-100 text-yellow-850 font-extrabold text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase font-mono">Generative AI</span>
          <span className="text-slate-400 text-[10px] font-bold uppercase font-mono">Gemini LLM Integration</span>
        </div>
        <h2 className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-yellow-500" />
          URC IT Intelligent Copilot Terminal
        </h2>
        <p className="text-[11px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
          Queries current URC inventory records (laptops, license contracts, and rack switches) directly through the server-side Gemini API. Formulates real-time optimization schedules and procurement warnings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Left: Quick Assistant Triggers */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs lg:col-span-1 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase font-mono">
                <HelpCircle className="h-4 w-4 text-slate-400" />
                Quick Analytics Actions
              </h3>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Click any operational trigger to analyze inventory metrics instantly:
            </p>

            <div className="space-y-1.5">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(p)}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded bg-slate-50 border border-slate-150 hover:border-yellow-400/50 hover:bg-yellow-50/10 text-[11px] font-medium text-slate-650 transition-colors leading-normal disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={clearChat}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold py-1.5 px-3 rounded text-xs transition-colors flex items-center justify-center gap-1.5 font-mono uppercase"
          >
            <Trash2 className="h-3.5 w-3.5 text-slate-550" />
            Reset Chat Logs
          </button>
        </div>

        {/* Right: Immersive Conversational Frame */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs lg:col-span-3 flex flex-col h-[480px] justify-between">
          
          {/* Chat Stream Area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                className={`flex gap-2.5 max-w-[90%] ${
                  m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar Icon */}
                <div className={`h-6.5 w-6.5 rounded shrink-0 flex items-center justify-center border font-bold text-[9px] font-mono ${
                  m.sender === 'user' 
                    ? 'bg-slate-900 border-slate-800 text-white' 
                    : 'bg-yellow-50 border-yellow-100 text-yellow-800'
                }`}>
                  {m.sender === 'user' ? 'ME' : 'URC'}
                </div>

                <div className={`p-3 rounded text-[11px] shadow-xs ${
                  m.sender === 'user' 
                    ? 'bg-slate-900 text-slate-100 rounded-tr-none' 
                    : 'bg-slate-50 border border-slate-150 text-slate-700 rounded-tl-none leading-relaxed'
                }`}>
                  {m.sender === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  ) : (
                    <div className="space-y-1 font-sans">
                      {parseMarkdown(m.text)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pulsing Loading indicator */}
            {isLoading && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto items-center animate-pulse">
                <div className="h-6.5 w-6.5 rounded shrink-0 bg-yellow-50 border border-yellow-100 text-yellow-850 flex items-center justify-center">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-yellow-650" />
                </div>
                <div className="p-3 rounded bg-slate-50 border border-slate-150 text-[10px] text-slate-400 font-mono italic">
                  Copilot is parsing database assets... Please hold...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Entry Box */}
          <div className="pt-2.5 border-t border-slate-150 space-y-1.5">
            {errorMsg && (
              <div className="bg-red-50 p-2 rounded border border-red-100 text-[10px] text-red-600 flex items-center gap-1.5 font-mono">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>API Connection status: {errorMsg}. Demonstrating system simulation gracefully.</span>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask e.g. Recommend spare parts to order based on reorder levels..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isLoading}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white text-slate-700 font-sans"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !userInput.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1 font-mono uppercase"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
