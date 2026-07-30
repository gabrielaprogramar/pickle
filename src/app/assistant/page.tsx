'use client';

import { useState, useRef, useEffect } from "react";
import { Send, Plus, ChevronDown, ChevronRight, Bot, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { STANDARD_DISCLAIMER } from "@/lib/assistant/safety";

// --- Types ---

interface Citation {
  source: string;
  article_section: string | null;
  excerpt: string;
}

interface ToolCallInfo {
  toolName: string;
  success: boolean;
  latencyMs: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | null;
  citations?: ReadonlyArray<Citation>;
  toolCalls?: ReadonlyArray<ToolCallInfo>;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

// --- Helpers ---

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffHrs < 1) {
    const mins = Math.floor(diffMs / 60000);
    return `${mins}m ago`;
  }
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
  return d.toLocaleDateString();
}

// --- Page Component ---

export default function AssistantPage() {
  const [conversations, setConversations] = useState<ReadonlyArray<Conversation>>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([]);
  const [input, setInput] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  async function fetchConversations() {
    setLoadingConversations(true);
    setConversationsError(null);
    try {
      const res = await fetch("/api/assistant/conversations?user_id=user-001");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load conversations");
      setConversations(json.data.conversations);
    } catch (err) {
      setConversationsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingConversations(false);
    }
  }

  async function fetchMessages(conversationId: string) {
    setLoadingMessages(true);
    setMessagesError(null);
    try {
      const res = await fetch(`/api/assistant/conversations/${conversationId}/messages`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load messages");
      const msgs: ReadonlyArray<ChatMessage> = (json.data.messages ?? []).map((m: Record<string, unknown>) => {
        const meta = m.metadata as Record<string, unknown> | undefined;
        return {
          id: m.id as string,
          role: m.role as "user" | "assistant",
          content: (m.content as string | null) ?? "",
          citations: m.citations as ReadonlyArray<Citation> | undefined,
          toolCalls: meta?.toolCalls as ReadonlyArray<ToolCallInfo> | undefined,
          created_at: m.created_at as string,
        };
      });
      setMessages(msgs);
    } catch (err) {
      setMessagesError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleNewConversation() {
    try {
      const res = await fetch("/api/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-001", title: "New conversation" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to create conversation");
      const conv = json.data.conversation;
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !activeConversationId || sending) return;

    setSending(true);
    setInput("");

    // Optimistic user message
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(`/api/assistant/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to send message");

      // Replace optimistic message with real one, add assistant message
      const userMsg: ChatMessage = {
        id: json.data.userMessage.id,
        role: "user",
        content: json.data.userMessage.content,
        created_at: json.data.userMessage.created_at,
      };

      const response = json.data.response;
      const assistantMsg: ChatMessage = {
        id: json.data.assistantMessage.id,
        role: "assistant",
        content: response.content,
        citations: response.citations?.map((c: Record<string, unknown>) => ({
          source: c.source as string,
          article_section: (c.article_section as string | null) ?? null,
          excerpt: c.excerpt as string,
        })) ?? [],
        toolCalls: response.toolCalls?.map((t: Record<string, unknown>) => ({
          toolName: t.toolName as string,
          success: t.success as boolean,
          latencyMs: t.latencyMs as number,
        })) ?? [],
        created_at: json.data.assistantMessage.created_at,
      };

      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      // Update conversation title if it was auto-generated
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId && c.title === "New conversation" ? { ...c, title: trimmed.slice(0, 60) } : c)),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: `Error: ${err instanceof Error ? err.message : String(err)}`, created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function toggleToolCall(id: string) {
    setExpandedToolCalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 lg:-m-6">
      {/* Conversation sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Conversations
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewConversation}
            className="h-7 px-2"
            title="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loadingConversations && (
            <div className="flex items-center justify-center py-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Loading...
              </p>
            </div>
          )}

          {conversationsError && (
            <ErrorBanner message={conversationsError} onRetry={fetchConversations} />
          )}

          {!loadingConversations && !conversationsError && conversations.length === 0 && (
            <EmptyState
              icon={<Bot className="h-6 w-6" />}
              title="No conversations"
              description="Start a new conversation to ask questions."
            />
          )}

          {!loadingConversations && conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors hover:bg-sidebar-accent/50 ${
                activeConversationId === conv.id ? "bg-sidebar-accent" : ""
              }`}
            >
              <p className="text-xs font-medium truncate text-foreground">
                {conv.title || "Untitled"}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {formatTimestamp(conv.created_at)}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Bot className="h-10 w-10" />}
              title="AI Assistant"
              description="Select a conversation or create a new one to start."
            />
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
              {loadingMessages && (
                <div className="flex items-center justify-center py-12">
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    Loading messages...
                  </p>
                </div>
              )}

              {messagesError && (
                <ErrorBanner message={messagesError} onRetry={() => fetchMessages(activeConversationId)} />
              )}

              {!loadingMessages && !messagesError && messages.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Bot className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Ask a question about compliance, regulations, or fleet data.</p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                    {/* Citations (assistant only) */}
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                          Sources
                        </p>
                        <div className="space-y-1">
                          {msg.citations.map((cit, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                [{i + 1}]
                              </span>
                              <div>
                                <p className="text-[11px] leading-tight text-muted-foreground">
                                  {cit.source}
                                  {cit.article_section && <span className="opacity-70"> &mdash; {cit.article_section}</span>}
                                </p>
                                <p className="text-[10px] leading-tight text-muted-foreground/60 mt-0.5 line-clamp-2">
                                  {cit.excerpt}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tool calls (assistant only) */}
                    {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <button
                          onClick={() => toggleToolCall(msg.id)}
                          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedToolCalls.has(msg.id) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          View tool activity ({msg.toolCalls.length})
                        </button>
                        {expandedToolCalls.has(msg.id) && (
                          <div className="mt-1.5 space-y-1">
                            {msg.toolCalls.map((tc, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                  tc.success ? "bg-success" : "bg-destructive"
                                }`} />
                                <span className="font-mono">{tc.toolName}</span>
                                <span className="text-[10px] opacity-60">{tc.latencyMs}ms</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" style={{ animationDelay: "200ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Disclaimer */}
            <div className="px-4 py-1.5 border-t border-border bg-card">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[10px] leading-tight text-muted-foreground/60">
                  {STANDARD_DISCLAIMER}
                </p>
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ minHeight: 36, maxHeight: 120 }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSend}
                  disabled={sending || !input.trim() || !activeConversationId}
                  className="h-9 w-9 p-0 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
