'use client';

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Plus,
  ChevronDown,
  ChevronRight,
  Bot,
  AlertTriangle,
  Ship,
  ShieldCheck,
  FileText,
  ExternalLink,
  X,
  Info,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Vessel {
  id: string;
  name: string;
  imo: string;
}

interface ComplianceStatus {
  fuelEu: { status: "compliant" | "warning" | "error"; label: string; details: string };
  euEts: { status: "compliant" | "warning" | "error"; label: string; details: string };
  verifier: { status: "compliant" | "warning" | "error"; label: string; details: string };
}

interface ParsedSection {
  type: "answer" | "evidence" | "why" | "recommendedAction" | "sources" | "text";
  content: string;
}

interface HandoffInfo {
  target: string;
  reason: string;
  label: string;
}

// --- Mock Data ---

const VESSELS: ReadonlyArray<Vessel> = [
  { id: "vsl-001", name: "MSC Djamila", imo: "9443731" },
  { id: "vsl-002", name: "MSC Diletta", imo: "9443743" },
  { id: "vsl-003", name: "Maersk Evora", imo: "9443755" },
  { id: "vsl-004", name: "CMA CGM T. Jefferson", imo: "9443767" },
  { id: "vsl-005", name: "Ever Given", imo: "9443779" },
];

const REGULATORY_SCHEMES = [
  { label: "FuelEU", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { label: "EU ETS", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { label: "MRV", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
];

const SUGGESTED_QUESTIONS = [
  "What is my FuelEU compliance status?",
  "What are my EU ETS obligations?",
  "Are there any open violations?",
  "Is my verifier package ready?",
  "What is the emissions trend for this vessel?",
];

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

function parseSections(content: string | null): ParsedSection[] {
  if (!content) return [];

  const sectionHeaders: Record<string, ParsedSection["type"]> = {
    "**answer**": "answer",
    "**evidence**": "evidence",
    "**why**": "why",
    "**recommended action**": "recommendedAction",
    "**sources**": "sources",
    "**recommended action:**": "recommendedAction",
    "**answer:**": "answer",
    "**evidence:**": "evidence",
    "**why:**": "why",
    "**sources:**": "sources",
  };

  const lower = content.toLowerCase();
  const sections: ParsedSection[] = [];

  const markerRegex = /\*\*(answer|evidence|why|recommended action|sources)\*\*:?\s*/gi;
  const matches: { index: number; type: ParsedSection["type"] }[] = [];
  let match;
  while ((match = markerRegex.exec(lower)) !== null) {
    const key = match[1]!.toLowerCase();
    const mappedKey = key === "recommended action" ? "recommendedAction" : (key as ParsedSection["type"]);
    matches.push({ index: match.index, type: mappedKey });
  }

  if (matches.length === 0) {
    return [{ type: "text", content }];
  }

  matches.sort((a, b) => a.index - b.index);

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const headerText = content.slice(start, start + content.slice(start).search(/\n/)).trim();
    const contentStart = start + headerText.length;
    const end = i < matches.length - 1 ? matches[i + 1]!.index : content.length;
    const sectionContent = content.slice(contentStart, end).trim();
    if (sectionContent) {
      sections.push({ type: matches[i]!.type, content: sectionContent });
    }
  }

  if (sections.length === 0) {
    return [{ type: "text", content }];
  }

  return sections;
}

function detectHandoff(content: string | null): HandoffInfo | null {
  if (!content) return null;

  const handoffs: { pattern: RegExp; target: string; label: string }[] = [
    { pattern: /hand(?:ing|off)\s*(?:to|over\s*to)\s*(?:the\s*)?voyage/i, target: "voyage", label: "Voyage Specialist" },
    { pattern: /transf(?:er|erring)\s*(?:to|over\s*to)\s*(?:the\s*)?voyage/i, target: "voyage", label: "Voyage Specialist" },
    { pattern: /hand(?:ing|off)\s*(?:to|over\s*to)\s*(?:the\s*)?maintenance/i, target: "maintenance", label: "Maintenance Specialist" },
    { pattern: /transf(?:er|erring)\s*(?:to|over\s*to)\s*(?:the\s*)?maintenance/i, target: "maintenance", label: "Maintenance Specialist" },
    { pattern: /hand(?:ing|off)\s*(?:to|over\s*to)\s*(?:the\s*)?ocr/i, target: "ocr", label: "OCR Specialist" },
    { pattern: /transf(?:er|erring)\s*(?:to|over\s*to)\s*(?:the\s*)?ocr/i, target: "ocr", label: "OCR Specialist" },
    { pattern: /hand(?:ing|off)\s*(?:to|over\s*to)\s*(?:the\s*)?captain/i, target: "captain", label: "Captain\'s Dashboard" },
    { pattern: /transf(?:er|erring)\s*(?:to|over\s*to)\s*(?:the\s*)?captain/i, target: "captain", label: "Captain\'s Dashboard" },
    { pattern: /specialist\s*(?:can\s*)?(?:assist|help|handle)/i, target: "specialist", label: "Specialist Team" },
  ];

  for (const h of handoffs) {
    if (h.pattern.test(content)) {
      const reasonMatch = content.match(/(?:reason|because|for|regarding)[:：]\s*(.+?)(?:\.|$)/i);
      return {
        target: h.target,
        label: h.label,
        reason: reasonMatch ? reasonMatch[1]!.trim() : "Specialized assistance required",
      };
    }
  }

  return null;
}

function getToolCallStatus(toolCall: ToolCallInfo): "success" | "error" | "partial" {
  if (toolCall.success) return "success";
  if (toolCall.latencyMs > 10000) return "partial";
  return "error";
}

function getToolCallColor(status: "success" | "error" | "partial"): string {
  switch (status) {
    case "success": return "bg-green-500";
    case "error": return "bg-red-500";
    case "partial": return "bg-yellow-500";
  }
}

// --- Sub-Components ---

function SectionBlock({ section }: { readonly section: ParsedSection }) {
  const styleMap: Record<ParsedSection["type"], { label: string; borderColor: string; bgColor: string }> = {
    answer: {
      label: "Answer",
      borderColor: "border-l-blue-500",
      bgColor: "bg-blue-500/5",
    },
    evidence: {
      label: "Evidence",
      borderColor: "border-l-emerald-500",
      bgColor: "bg-emerald-500/5",
    },
    why: {
      label: "Why",
      borderColor: "border-l-amber-500",
      bgColor: "bg-amber-500/5",
    },
    recommendedAction: {
      label: "Recommended Action",
      borderColor: "border-l-violet-500",
      bgColor: "bg-violet-500/5",
    },
    sources: {
      label: "Sources",
      borderColor: "border-l-slate-500",
      bgColor: "bg-slate-500/5",
    },
    text: {
      label: "",
      borderColor: "",
      bgColor: "",
    },
  };

  const style = styleMap[section.type];

  if (section.type === "text") {
    return <p className="whitespace-pre-wrap break-words">{section.content}</p>;
  }

  return (
    <div className={`border-l-2 ${style.borderColor} ${style.bgColor} rounded-r-md px-3 py-2 my-2`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold mb-1 text-foreground/70">
        {style.label}
      </p>
      <p className="text-xs whitespace-pre-wrap break-words text-foreground/90">{section.content}</p>
    </div>
  );
}

function HandoffBanner({ handoff }: { readonly handoff: HandoffInfo }) {
  const routeMap: Record<string, string> = {
    voyage: "/voyages",
    maintenance: "/maintenance",
    ocr: "/ocr",
    captain: "/fleet",
    specialist: "/assistant",
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 mt-2">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
          Handoff suggested
        </p>
        <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
          {handoff.label} — {handoff.reason}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0"
        onClick={() => {
          const href = routeMap[handoff.target] ?? "/assistant";
          window.location.href = href;
        }}
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Open
      </Button>
    </div>
  );
}

// --- Page Component ---

export default function ComplianceAssistantPage() {
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
  const [selectedVesselId, setSelectedVesselId] = useState<string>(VESSELS[0]!.id);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedVessel = useMemo(
    () => VESSELS.find((v) => v.id === selectedVesselId) ?? VESSELS[0]!,
    [selectedVesselId],
  );

  const complianceStatus = useMemo((): ComplianceStatus => {
    const vesselIndex = VESSELS.findIndex((v) => v.id === selectedVesselId);
    const statuses: ComplianceStatus[] = [
      {
        fuelEu: { status: "compliant", label: "FuelEU Compliant", details: "94.2% below target" },
        euEts: { status: "compliant", label: "EU ETS Compliant", details: "All allowances covered" },
        verifier: { status: "compliant", label: "Verifier Ready", details: "MRV report submitted" },
      },
      {
        fuelEu: { status: "warning", label: "FuelEU At Risk", details: "2.1% above trajectory" },
        euEts: { status: "compliant", label: "EU ETS Compliant", details: "All allowances covered" },
        verifier: { status: "error", label: "Verifier Not Ready", details: "Missing MRV report" },
      },
      {
        fuelEu: { status: "compliant", label: "FuelEU Compliant", details: "91.8% below target" },
        euEts: { status: "warning", label: "EU ETS Short", details: "3 allowances needed" },
        verifier: { status: "warning", label: "Verifier Pending", details: "Review in progress" },
      },
      {
        fuelEu: { status: "error", label: "FuelEU Non-Compliant", details: "Exceeded by 5.3%" },
        euEts: { status: "error", label: "EU ETS Non-Compliant", details: "8 allowances short" },
        verifier: { status: "error", label: "Verifier Not Ready", details: "MRV report due" },
      },
      {
        fuelEu: { status: "compliant", label: "FuelEU Compliant", details: "96.7% below target" },
        euEts: { status: "compliant", label: "EU ETS Compliant", details: "Surplus 12 allowances" },
        verifier: { status: "compliant", label: "Verifier Ready", details: "All documents filed" },
      },
    ];
    return statuses[Math.max(0, vesselIndex)] ?? statuses[0]!;
  }, [selectedVesselId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchConversations();
  }, []);

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
        body: JSON.stringify({ user_id: "user-001", title: "New compliance conversation" }),
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

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const body: Record<string, unknown> = { content: trimmed };
      if (selectedVesselId) {
        body.vessel_context = { id: selectedVesselId, name: selectedVessel.name, imo: selectedVessel.imo };
      }

      const res = await fetch(`/api/assistant/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to send message");

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

      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId && c.title === "New compliance conversation" ? { ...c, title: trimmed.slice(0, 60) } : c)),
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

  function handleSuggestedQuestion(q: string) {
    setInput(q);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function toggleToolCall(id: string) {
    setExpandedToolCalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openSourcePanel(citation: Citation) {
    setSelectedCitation(citation);
    setSourcePanelOpen(true);
  }

  function closeSourcePanel() {
    setSourcePanelOpen(false);
    setSelectedCitation(null);
  }

  function toggleSourceExpand(id: string) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 lg:-m-6">
      {/* Left sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground font-semibold">
            Compliance
          </h2>
          <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0">
            v2.1
          </Badge>
        </div>

        {/* Vessel selector */}
        <div className="p-3 border-b border-border">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1.5">
            Vessel
          </p>
          <select
            value={selectedVesselId}
            onChange={(e) => setSelectedVesselId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {VESSELS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.imo})
              </option>
            ))}
          </select>
        </div>

        {/* Conversations */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
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
              description="Start a new compliance conversation."
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

        {/* Compliance status strip */}
        <div className="border-t border-border p-3 space-y-2 bg-muted/30">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Compliance Status
          </p>
          <div className="space-y-1.5">
            {[
              { key: "fuelEu" as const, label: "FuelEU", icon: "F" },
              { key: "euEts" as const, label: "EU ETS", icon: "E" },
              { key: "verifier" as const, label: "Verifier", icon: "V" },
            ].map((item) => {
              const status = complianceStatus[item.key];
              const dotColor = status.status === "compliant" ? "bg-green-500" : status.status === "warning" ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={item.key} className="flex items-center gap-2">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium leading-tight text-foreground truncate">
                      {status.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 leading-tight truncate">
                      {status.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with badges */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {selectedVessel.name}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              IMO {selectedVessel.imo}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {REGULATORY_SCHEMES.map((scheme) => (
              <span
                key={scheme.label}
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide ${scheme.color}`}
              >
                {scheme.label}
              </span>
            ))}
          </div>
        </div>

        {!activeConversationId ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <EmptyState
              icon={<ShieldCheck className="h-10 w-10" />}
              title="Compliance Assistant"
              description="Select a conversation or create a new one to get compliance guidance."
            />
            <div className="mt-6 flex flex-wrap justify-center gap-2 px-4 max-w-md">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestedQuestion(q)}
                  className="text-left px-3 py-1.5 rounded-md border border-border bg-card hover:bg-sidebar-accent/50 transition-colors text-xs text-muted-foreground hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
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
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-center mb-4">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Ask a compliance question for {selectedVessel.name}.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSuggestedQuestion(q)}
                        className="text-left px-3 py-1.5 rounded-md border border-border bg-card hover:bg-sidebar-accent/50 transition-colors text-xs text-muted-foreground hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const sections = msg.role === "assistant" ? parseSections(msg.content) : [];
                const handoff = msg.role === "assistant" ? detectHandoff(msg.content) : null;
                const hasStructuredSections = sections.length > 1 || sections[0]?.type !== "text";

                return (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      ) : hasStructuredSections ? (
                        <div className="space-y-1">
                          {sections.map((section, i) => (
                            <SectionBlock key={i} section={section} />
                          ))}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}

                      {/* Handoff banner */}
                      {handoff && <HandoffBanner handoff={handoff} />}

                      {/* Citations (assistant only) */}
                      {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                            Sources
                          </p>
                          <div className="space-y-1">
                            {msg.citations.map((cit, i) => (
                              <button
                                key={i}
                                onClick={() => openSourcePanel(cit)}
                                className="w-full text-left flex items-start gap-1.5 hover:bg-background/50 rounded-sm px-1 py-0.5 transition-colors"
                              >
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
                              </button>
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
                              {msg.toolCalls.map((tc, i) => {
                                const status = getToolCallStatus(tc);
                                return (
                                  <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${getToolCallColor(status)}`} />
                                    <span className="font-mono">{tc.toolName}</span>
                                    <span className="text-[10px] opacity-60">{tc.latencyMs}ms</span>
                                    {status === "partial" && (
                                      <span className="text-[9px] text-yellow-600 dark:text-yellow-400 font-mono uppercase">
                                        partial
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

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
            <div className="px-4 py-2 border-t border-border bg-card">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
                    Disclaimer
                  </p>
                  <p className="text-[10px] leading-tight text-muted-foreground/70 mt-0.5">
                    {STANDARD_DISCLAIMER}
                  </p>
                </div>
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
                  placeholder={`Ask about compliance for ${selectedVessel.name}...`}
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

      {/* Source detail panel */}
      {sourcePanelOpen && selectedCitation && (
        <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground font-semibold">
                Source Details
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeSourcePanel}
              className="h-6 w-6 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                Source
              </p>
              <p className="text-xs font-medium text-foreground">{selectedCitation.source}</p>
            </div>
            {selectedCitation.article_section && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                  Article / Section
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {selectedCitation.article_section}
                </Badge>
              </div>
            )}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                Excerpt
              </p>
              <div className="rounded-md bg-muted/50 p-2.5">
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {selectedCitation.excerpt}
                </p>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                Regulatory Scheme
              </p>
              <div className="flex gap-1">
                {REGULATORY_SCHEMES.map((scheme) => (
                  <span
                    key={scheme.label}
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide ${scheme.color}`}
                  >
                    {scheme.label}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                Confidence
              </p>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-green-500 w-3/4" />
                <span className="text-[10px] text-muted-foreground">High</span>
              </div>
            </div>
          </div>
          <div className="border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[10px] h-7"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${selectedCitation.source}\n${selectedCitation.article_section ? `Section: ${selectedCitation.article_section}\n` : ""}${selectedCitation.excerpt}`
                );
              }}
            >
              Copy reference
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}
