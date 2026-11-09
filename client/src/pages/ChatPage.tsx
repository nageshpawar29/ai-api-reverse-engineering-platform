import React, { useContext, useEffect, useRef, useState } from 'react';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  FileCode,
  CornerDownLeft,
  HelpCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { ChatMessage } from '../types';

export const ChatPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'What does POST /users do?',
    'Which endpoints require authentication?',
    'Which controller accesses the User model?',
    'What APIs modify the database?',
    'List all endpoints and their controller handlers',
  ];

  useEffect(() => {
    if (!analysis?.project?.id) return;

    const fetchHistory = async () => {
      try {
        const res = await apiClient.get<ChatMessage[]>(`/chat/${analysis.project.id}/messages`);
        if (res.data && res.data.length > 0) {
          setMessages(res.data);
        } else {
          // Welcome greeting
          setMessages([
            {
              id: 'initial',
              projectId: analysis.project.id,
              role: 'assistant',
              content: `Hello! I have analyzed the **${analysis.project.name}** repository using AST static parsing. You can ask me anything about route paths, controller logic, middleware chains, database models, or security findings.`,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    fetchHistory();
  }, [analysis?.project?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || !analysis?.project?.id || isSending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      projectId: analysis.project.id,
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await apiClient.post<ChatMessage>(`/chat/${analysis.project.id}/ask`, {
        prompt: userMsg.content,
      });
      setMessages((prev) => [...prev, res.data]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          projectId: analysis.project.id,
          role: 'assistant',
          content: 'Sorry, I encountered an issue querying the codebase reasoning engine.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (loading || !analysis) return null;

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-6rem)] pb-4">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bot className="h-6 w-6 text-indigo-400" />
            <span>AI Codebase Assistant</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Grounded Q&A powered by the AST knowledge graph of {analysis.project.name}.
          </p>
        </div>
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="mb-4 space-y-2">
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Suggested questions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800 text-xs text-slate-300 transition-all text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 text-sm leading-relaxed ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="h-8 w-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 space-y-2 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Citations */}
              {m.citations && m.citations.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                    Source Citations:
                  </div>
                  {m.citations.map((c, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-indigo-400 mr-2"
                    >
                      <FileCode className="h-3 w-3" />
                      <span>
                        {c.file}
                        {c.line && `:${c.line}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <div className="h-8 w-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3 text-sm">
            <div className="h-8 w-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Analyzing AST knowledge model...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about routes, controllers, models, or security..."
          disabled={isSending}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 transition-all"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
};
