import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Send, Bot, User as UserIcon, Activity, Key, Loader2, ArrowLeft,
  Settings, Trash2, Brain, FileText, Calendar, Dumbbell, Apple,
  Shield, Zap
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import {
  sendAIMessage, getChatHistory, clearChatHistory, type ChatMessageEntry 
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";

export default function AIHealthAssistant() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, token, user, logout } = useRequiredAuth("patient");

  const [message, setMessage] = useState("");
  // Data Sharing Settings
  const [shareMedicalHistory, setShareMedicalHistory] = useState(true);
  const [shareMedications, setShareMedications] = useState(true);
  const [shareHealthMetrics, setShareHealthMetrics] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const historyQuery = useQuery({
    queryKey: ["chat-history"],
    queryFn: () => getChatHistory(token!),
    enabled: isAuthenticated && Boolean(token),
    refetchInterval: false,
  });

  const chatMutation = useMutation({
    mutationFn: async (msg: string) => {
      if (!token) throw new Error("Not authenticated");
      return sendAIMessage(token, {
        message: msg,
        include_medical_history: shareMedicalHistory,
        include_medications: shareMedications,
        include_health_metrics: shareHealthMetrics
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-history"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      return clearChatHistory(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-history"] });
      toast({ title: "Chat history cleared" });
    }
  });

  const messages = historyQuery.data?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, chatMutation.isPending]);

  const handleSend = (e?: React.FormEvent, msgToSend?: string) => {
    e?.preventDefault();
    const trimmed = (msgToSend || message).trim();
    if (!trimmed || chatMutation.isPending) return;
    setMessage("");
    chatMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/patient" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm hidden sm:block">Dashboard</span>
            </Link>
            <Separator orientation="vertical" className="h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">AI Health Assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard/patient/calendar">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 gap-1">
                <Calendar className="h-4 w-4" /> Calendar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar – context controls */}
          <div className="lg:col-span-1 space-y-3 order-2 lg:order-1">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  Data Shared with AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Medical History</span>
                  <Switch checked={shareMedicalHistory} onCheckedChange={setShareMedicalHistory} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Medications</span>
                  <Switch checked={shareMedications} onCheckedChange={setShareMedications} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Health Metrics</span>
                  <Switch checked={shareHealthMetrics} onCheckedChange={setShareHealthMetrics} />
                </div>
                <Separator className="bg-white/10" />
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Toggle which data the AI can access. Your data is only sent when you send a message.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Quick Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "What exercises are safe for my conditions?",
                  "How can I improve my sleep quality?",
                  "What vitamins should I consider?",
                  "How many calories should I eat daily?",
                ].map((q) => (
                  <button
                    key={q}
                    className="w-full text-left text-xs text-white/50 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                    onClick={() => {
                      setMessage(q);
                      inputRef.current?.focus();
                    }}
                  >
                    {q}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="h-3 w-3" /> Clear Chat
            </Button>
          </div>

          {/* Chat area */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <Card className="bg-white/5 border-white/10 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
              {/* Nav Cards */}
              <div className="flex gap-4 p-4 border-b bg-white/5">
                <Link to="/dashboard/patient/exercise-planner" className="flex-1">
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-transparent hover:border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Dumbbell className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-sm text-white">Exercise Planner</h3>
                        <p className="text-xs text-white/60 mt-0.5">Generate weekly schedules</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/dashboard/patient/diet-planner" className="flex-1">
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-transparent hover:border-orange-500/20 bg-orange-500/5">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                        <Apple className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-sm text-white">Diet Planner</h3>
                        <p className="text-xs text-white/60 mt-0.5">Generate daily meal plans</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 && !chatMutation.isPending ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                      <Bot className="h-12 w-12 mb-4 text-white/60" />
                      <h3 className="text-lg font-medium mb-2 text-white">How can I help with your health today?</h3>
                      <p className="text-sm max-w-sm mb-6 text-white/50">
                        I can answer questions about your symptoms, medications, or general wellness.
                        I'll use your shared medical context to provide tailored advice.
                      </p>
                      <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                        {["What does my latest blood pressure reading mean?",
                          "How to manage my diabetes better?",
                          "Can you explain my current medications?",
                          "Tips for better sleep hygiene"].map((q, i) => (
                            <Button key={i} variant="outline" className="text-xs h-auto py-3 px-4 justify-start text-left border-white/20 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => handleSend(undefined, q)}>
                              {q}
                            </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-1">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-md"
                              : "bg-white/10 text-white/90 border border-white/10 rounded-bl-md"
                          }`}
                        >
                          <div className="prose prose-invert prose-p:leading-relaxed max-w-none text-sm">
                            <ReactMarkdown>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                        {msg.role === "user" && (
                          <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 mt-1">
                            <UserIcon className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}

                    {chatMutation.isPending && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Thinking...
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 bg-white/5 border-t border-white/10 mt-auto">
                <form 
                  onSubmit={(e) => handleSend(e)} 
                  className="flex items-end gap-3 max-w-4xl mx-auto"
                >
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about symptoms, workouts, nutrition..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
                      rows={1}
                      style={{ minHeight: "52px", maxHeight: "150px" }}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={chatMutation.isPending || !message.trim()}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white h-[52px] w-[52px] shrink-0 rounded-xl"
                  >
                    {chatMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
