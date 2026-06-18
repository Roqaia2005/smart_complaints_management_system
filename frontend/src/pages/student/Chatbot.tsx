import React from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../../types/workflow';
import { Badge } from '@/components/ui/badge';

export default function StudentChatbot() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your UniResolve assistant. How can I help you today? You can describe any issue or complaint you're facing.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI logic
    setTimeout(() => {
      const content = userMsg.content.toLowerCase();
      let aiResponse: ChatMessage;

      if (content.includes('wifi') || content.includes('internet')) {
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I've detected an issue with the campus network. Could you please specify which building or area you are currently in?",
          type: 'follow_up',
          data: { field: 'location' },
          timestamp: new Date().toISOString()
        };
      } else if (content.includes('library') || content.includes('hall')) {
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I have gathered all the details. Here is a summary of your complaint before I submit it to the IT department:",
          type: 'card',
          data: {
            subject: 'WiFi Connectivity Issue',
            category: 'Technical / IT',
            location: content,
            description: 'Unstable internet connection reported by the student.',
            priority: 'Medium'
          },
          timestamp: new Date().toISOString()
        };
      } else {
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I understand. Could you provide a bit more detail about the situation so I can classify it correctly?",
          timestamp: new Date().toISOString()
        };
      }

      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto border bg-card rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
      {/* Header */}
      <div className="p-4 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white">UniResolve AI</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Assistant</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setMessages([messages[0]])}>
          <Trash2 size={18} />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-none">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex items-start gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                msg.role === 'user' ? "bg-slate-800 text-white" : "bg-blue-600 text-white"
              )}>
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>
              <div className="space-y-2">
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === 'user'
                    ? "bg-slate-800 text-white rounded-tr-none"
                    : "bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                )}>
                  {msg.content}
                </div>

                {/* AI Summary Card */}
                {msg.type === 'card' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4"
                  >
                    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 overflow-hidden">
                      <div className="p-4 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between bg-blue-100/50 dark:bg-blue-900/50">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={14} /> Complaint Draft
                        </span>
                        <Badge variant="warning">{msg.data.priority}</Badge>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</p>
                          <p className="font-semibold text-slate-800 dark:text-white">{msg.data.subject}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Category</p>
                            <p className="text-xs font-medium">{msg.data.category}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Location</p>
                            <p className="text-xs font-medium">{msg.data.location}</p>
                          </div>
                        </div>
                        <Button className="w-full h-10 gap-2 font-bold shadow-lg shadow-blue-500/20">
                          Confirm & Submit <ChevronRight size={16} />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
        <form onSubmit={handleSend} className="relative flex items-center gap-2 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-blue-500 shadow-sm"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-1.5 h-9 w-9 rounded-lg shadow-lg shadow-blue-500/20"
            disabled={!input.trim() || isTyping}
          >
            <Send size={18} />
          </Button>
        </form>
        <p className="text-[10px] text-center text-slate-500 mt-3 font-medium">
          UniResolve AI may provide helpful information. Please review all details before submitting.
        </p>
      </div>
    </div>
  );
}

