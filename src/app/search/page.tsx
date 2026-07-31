'use client';

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Save,
  RotateCw,
  Trash2,
  Pencil,
  Filter,
  FileText,
  Ship,
  Anchor,
  CalendarDays,
  Gauge,
  ArrowRight,
  ExternalLink,
  Info,
  AlertTriangle,
  ShieldCheck,
  ScrollText,
  ClipboardCheck,
  Boxes,
  BookOpen,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import type {
  SearchResults,
  SearchResultRecord,
  SavedSearch,
  RecentSearch,
  SearchHandoff,
} from "@/lib/search-assistant/types";

// --- Constants ---

const ORG_ID = "org-001";
const USER_ID = "user-001";
const PAGE_SIZE = 10;

const EXAMPLE_QUERIES: ReadonlyArray<string> = [
  "Find all BDNs from Palma last year",
  "Show documents with confidence below 0.8",
  "Find the 2024 THETIS report for Aurelia",
  "Which vessels have pending review tasks?",
  "Show audit events for Aurelia",
];

const ENTITY_ICONS: Record<string, LucideIcon> = {
  vessels: Ship,
  voyages: Anchor,
  ais_positions: Activity,
  fuel_deliveries: Boxes,
  documents: FileText,
  ocr_results: ScrollText,
  validation_reports: ClipboardCheck,
  review_tasks: ClipboardCheck,
  reports: BookOpen,
  verifier_packages: ShieldCheck,
  audit_log: Activity,
  regulatory: BookOpen,
};

const FIELD_DEFS: ReadonlyArray<{ readonly label: string; readonly keys: readonly string[] }> = [
  { label: "Vessel", keys: ["vesselName", "vessel_name"] },
  { label: "IMO", keys: ["imo"] },
  { label: "Port", keys: ["port", "departure_port", "arrival_port"] },
  { label: "Date", keys: ["date", "delivery_date", "uploaded_at", "processed_at", "generated_at", "created_at", "timestamp", "departure_date", "arrival_date"] },
  { label: "Type", keys: ["document_type", "report_type"] },
  { label: "Source", keys: ["source"] },
  { label: "Fuel", keys: ["fuel_type"] },
  { label: "Qty", keys: ["quantity_mt"] },
  { label: "Supplier", keys: ["supplier"] },
  { label: "Year", keys: ["year"] },
];

const DETAIL_LABELS: Record<string, string> = {
  id: "ID",
  imo: "IMO",
  entity: "Entity",
  title: "Title",
  identifier: "Identifier",
  vessel_name: "Vessel",
  vessel_id: "Vessel ID",
  vesselName: "Vessel",
  vesselId: "Vessel ID",
  source_record_id: "Source Record ID",
  sourceRecordId: "Source Record ID",
  document_type: "Document Type",
  report_type: "Report Type",
  fuel_type: "Fuel Type",
  quantity_mt: "Quantity (MT)",
  gross_tonnage: "Gross Tonnage",
  vessel_type: "Vessel Type",
  departure_port: "Departure Port",
  arrival_port: "Arrival Port",
  departure_date: "Departure Date",
  arrival_date: "Arrival Date",
  delivery_date: "Delivery Date",
  uploaded_at: "Uploaded",
  processed_at: "Processed",
  generated_at: "Generated",
  created_at: "Created",
  summary: "Summary",
  confidence: "Confidence",
  status: "Status",
  source: "Source",
  year: "Year",
  port: "Port",
  supplier: "Supplier",
};

// --- Types ---

interface SearchClarification {
  readonly message: string;
  readonly questions: ReadonlyArray<string>;
}

interface FieldRowItem {
  readonly label: string;
  readonly value: string;
  readonly isDate: boolean;
}

type StatusTone = "green" | "red" | "amber" | "neutral";

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

function entityLabel(entity: string): string {
  return entity
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function entityIcon(entity: string): LucideIcon {
  return ENTITY_ICONS[entity] ?? FileText;
}

function formatKey(key: string): string {
  return (
    DETAIL_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatDetailValue(key: string, value: unknown): string {
  if (typeof value === "number") {
    if (key === "confidence") return `${Math.round(value * 100)}%`;
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const s = String(value);
  if (s.length > 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function firstValue(record: SearchResultRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    const v = record[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function fieldRow(record: SearchResultRecord): ReadonlyArray<FieldRowItem> {
  const rows: FieldRowItem[] = [];
  for (const def of FIELD_DEFS) {
    const value = firstValue(record, def.keys);
    if (value === undefined) continue;
    rows.push({
      label: def.label,
      value: formatDetailValue(def.label.toLowerCase(), value),
      isDate: def.label === "Date",
    });
  }
  return rows;
}

function statusTone(status: string | undefined): StatusTone {
  const s = (status ?? "").toUpperCase();
  const greens = ["APPROVED", "SUCCESS", "COMPLETED", "READY", "SUBMITTED", "PROCESSED", "PASSED"];
  const reds = ["FAILED", "REJECTED", "IN_MAINTENANCE", "ERROR"];
  const ambers = ["PENDING", "DRAFT", "IN_PROGRESS", "LOW_CONFIDENCE", "NOT_STARTED", "PLANNED"];
  if (greens.includes(s)) return "green";
  if (reds.includes(s)) return "red";
  if (ambers.includes(s)) return "amber";
  return "neutral";
}

const STATUS_CLASSES: Record<StatusTone, string> = {
  green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

function confidencePct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function confidenceColor(value: number): string {
  if (value >= 0.9) return "bg-green-500";
  if (value >= 0.7) return "bg-amber-500";
  return "bg-red-500";
}

function errorMessage(json: Record<string, unknown>): string {
  const err = json.error;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { readonly message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Search failed";
}

// --- Sub-Components ---

function StatusBadge({ status }: { readonly status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] ${STATUS_CLASSES[statusTone(status)]}`}
    >
      {status}
    </span>
  );
}

function ResultCard({
  record,
  selected,
  onSelect,
}: {
  readonly record: SearchResultRecord;
  readonly selected: boolean;
  readonly onSelect: (record: SearchResultRecord) => void;
}) {
  const EntityIcon = entityIcon(record.entity);
  const rows = fieldRow(record);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(record)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(record);
        }
      }}
      className={`cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-sidebar-accent/40 ${
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <EntityIcon className="h-2.5 w-2.5" />
          {entityLabel(record.entity)}
        </span>
        {record.status && <StatusBadge status={record.status} />}
        <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/40" />
      </div>

      <p className="mt-2 text-sm font-medium text-foreground leading-snug">{record.title}</p>

      {rows.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {rows.map((f) => (
            <div key={f.label} className="flex items-center gap-1.5">
              {f.isDate && <CalendarDays className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                {f.label}
              </span>
              <span className="text-[11px] text-foreground/90">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {record.confidence !== undefined && record.confidence !== null && (
        <div className="mt-2 flex items-center gap-2">
          <Gauge className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${confidenceColor(record.confidence)}`}
              style={{ width: `${Math.min(100, Math.max(0, Math.round(record.confidence * 100)))}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{confidencePct(record.confidence)}</span>
        </div>
      )}

      {record.deepLink && (
        <div className="mt-2.5">
          <Link
            href={record.deepLink.path}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-primary hover:bg-secondary transition-colors"
          >
            {record.deepLink.label}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// --- Page Component ---

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [handoff, setHandoff] = useState<SearchHandoff | null>(null);
  const [clarification, setClarification] = useState<SearchClarification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ReadonlyArray<string>>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResultRecord | null>(null);
  const [lastModelInfo, setLastModelInfo] = useState<{ modelId: string; promptVersion: string } | null>(null);

  const [recentSearches, setRecentSearches] = useState<ReadonlyArray<RecentSearch>>([]);
  const [savedSearches, setSavedSearches] = useState<ReadonlyArray<SavedSearch>>([]);

  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchSaved();
    fetchRecent();
  }, []);

  async function fetchSaved() {
    try {
      const res = await fetch(`/api/search/saved?user_id=${USER_ID}&organization_id=${ORG_ID}`);
      const json: Record<string, unknown> = await res.json();
      if (json.success) {
        setSavedSearches((json.saved as SavedSearch[] | undefined) ?? []);
      }
    } catch {
      // Sidebar load errors are non-fatal.
    }
  }

  async function fetchRecent() {
    try {
      const res = await fetch(`/api/search/recent?user_id=${USER_ID}&organization_id=${ORG_ID}&limit=10`);
      const json: Record<string, unknown> = await res.json();
      if (json.success) {
        setRecentSearches((json.recent as RecentSearch[] | undefined) ?? []);
      }
    } catch {
      // Sidebar load errors are non-fatal.
    }
  }

  function handleSearchJson(json: Record<string, unknown>): boolean {
    setError(null);
    setSelectedResult(null);

    if (!json.success) {
      setError(errorMessage(json));
      setResults(null);
      setHandoff(null);
      setClarification(null);
      return false;
    }
    if (json.data) {
      const data = json.data as SearchResults;
      setResults(data);
      setHandoff(null);
      setClarification(null);
      setLastModelInfo({ modelId: data.modelId, promptVersion: data.promptVersion });
      return true;
    }
    if (json.handoff) {
      setHandoff(json.handoff as SearchHandoff);
      setResults(null);
      setClarification(null);
      return false;
    }
    if (json.clarification) {
      setClarification(json.clarification as SearchClarification);
      setResults(null);
      setHandoff(null);
      return false;
    }

    setError("Unexpected response from search service");
    setResults(null);
    setHandoff(null);
    setClarification(null);
    return false;
  }

  async function runSearch(q: string, pageNum: number) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          organization_id: ORG_ID,
          user_id: USER_ID,
          page: pageNum,
          page_size: PAGE_SIZE,
        }),
      });
      const ok = handleSearchJson(await res.json());
      if (ok) {
        setLastQuery(trimmed);
        setQuery(trimmed);
        await fetchRecent();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
      setHandoff(null);
      setClarification(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExample(q: string) {
    setQuery(q);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runSearch(query, 1);
    }
  }

  function toggleFilter(value: string) {
    setActiveFilters((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  }

  async function handleSaveSearch() {
    const name = saveName.trim();
    if (!name || !lastQuery || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, query: lastQuery, user_id: USER_ID, organization_id: ORG_ID }),
      });
      const json: Record<string, unknown> = await res.json();
      if (!json.success) throw new Error(errorMessage(json));
      setShowSave(false);
      setSaveName("");
      await fetchSaved();
    } catch (err) {
      console.error("Failed to save search:", err);
    } finally {
      setSaving(false);
    }
  }

  function startRename(saved: SavedSearch) {
    setRenamingId(saved.id);
    setRenameValue(saved.name);
  }

  async function handleRename() {
    if (!renamingId || !renameValue.trim()) return;
    try {
      const res = await fetch(
        `/api/search/saved/${renamingId}?user_id=${USER_ID}&organization_id=${ORG_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue.trim() }),
        },
      );
      const json: Record<string, unknown> = await res.json();
      if (!json.success) throw new Error(errorMessage(json));
      setRenamingId(null);
      setRenameValue("");
      await fetchSaved();
    } catch (err) {
      console.error("Failed to rename search:", err);
      setRenamingId(null);
    }
  }

  async function handleDeleteSaved(id: string) {
    try {
      const res = await fetch(`/api/search/saved/${id}?user_id=${USER_ID}&organization_id=${ORG_ID}`, {
        method: "DELETE",
      });
      const json: Record<string, unknown> = await res.json();
      if (!json.success) throw new Error(errorMessage(json));
      if (renamingId === id) setRenamingId(null);
      await fetchSaved();
    } catch (err) {
      console.error("Failed to delete search:", err);
    }
  }

  async function handleRerunSaved(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/search/saved/${id}/rerun?user_id=${USER_ID}&organization_id=${ORG_ID}`,
        { method: "POST" },
      );
      const ok = handleSearchJson(await res.json());
      if (ok) {
        const saved = savedSearches.find((s) => s.id === id);
        if (saved) {
          setQuery(saved.query);
          setLastQuery(saved.query);
        }
        await fetchRecent();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const showEmptyState = !loading && !error && !results && !handoff && !clarification;

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 lg:-m-6">
      {/* Left sidebar */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-card min-h-0">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground font-semibold">
            Search
          </h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-2.5 w-2.5" />
            Retrieve Only
          </span>
        </div>

        {/* Recent searches */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Recent
          </h2>
        </div>
        <div className="max-h-56 overflow-y-auto scrollbar-thin">
          {recentSearches.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground/60">
              No recent searches
            </p>
          )}
          {recentSearches.map((recent) => {
            const Icon = recent.entity ? entityIcon(recent.entity) : Search;
            return (
              <button
                key={recent.id}
                onClick={() => runSearch(recent.query, 1)}
                className="w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors hover:bg-sidebar-accent/50"
              >
                <p className="text-xs font-medium truncate text-foreground">{recent.query}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {recent.entity ? entityLabel(recent.entity) : "Query"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatTimestamp(recent.timestamp)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Saved searches */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Saved
          </h2>
          <FileText className="h-3 w-3 text-muted-foreground/60" />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {savedSearches.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground/60">
              No saved searches
            </p>
          )}
          {savedSearches.map((saved) => {
            const isRenaming = renamingId === saved.id;
            return (
              <div key={saved.id} className="px-3 py-2 border-b border-border/50">
                {isRenaming ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRename();
                        }
                      }}
                      className="h-6 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      size="sm"
                      className="h-6 px-1.5 text-[10px] shrink-0"
                      onClick={handleRename}
                      disabled={!renameValue.trim()}
                    >
                      OK
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className="w-full text-left cursor-pointer"
                      onClick={() => handleRerunSaved(saved.id)}
                    >
                      <p className="text-xs font-medium truncate text-foreground">{saved.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70 truncate">
                        {saved.query}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Rerun"
                        onClick={() => handleRerunSaved(saved.id)}
                      >
                        <RotateCw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Rename"
                        onClick={() => startRename(saved)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete"
                        onClick={() => handleDeleteSaved(saved.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
          <Search className="h-4 w-4 text-primary shrink-0" />
          <h1 className="font-serif text-lg font-medium tracking-tight text-foreground">
            Poseidon Search
          </h1>
          <Badge variant="outline" className="text-[9px] uppercase tracking-[0.1em] hidden sm:inline-flex">
            Search Assistant
          </Badge>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-2.5 w-2.5" />
            Retrieve Only
          </span>
          {lastModelInfo && (
            <span className="ml-auto rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {lastModelInfo.modelId} / {lastModelInfo.promptVersion}
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="border-b border-border bg-card px-4 py-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask to search — e.g. 'Find all BDNs from Palma last year'"
              rows={1}
              disabled={loading}
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
              onClick={() => runSearch(query, 1)}
              disabled={loading || !query.trim()}
              className="h-9 w-9 p-0 shrink-0"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleExample(q)}
                className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            {showSave ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveSearch();
                    }
                  }}
                  placeholder="Name this search"
                  className="h-7 w-48 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-[10px] font-mono uppercase tracking-[0.1em]"
                  onClick={handleSaveSearch}
                  disabled={!saveName.trim() || saving}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowSave(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground"
                onClick={() => setShowSave(true)}
                disabled={!lastQuery}
                title="Save the last executed search"
              >
                <Save className="h-3 w-3 mr-1" />
                Save this search
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
                <div
                  className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse"
                  style={{ animationDelay: "200ms" }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse"
                  style={{ animationDelay: "400ms" }}
                />
              </div>
            </div>
          )}

          {!loading && handoff && (
            <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  This query was routed to the Compliance Assistant
                </p>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                  Target: <span className="font-mono">{handoff.target}</span> — {handoff.reason}
                </p>
              </div>
            </div>
          )}

          {!loading && clarification && (
            <div className="flex items-start gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 mb-4">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {clarification.message}
                </p>
                {clarification.questions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {clarification.questions.map((question) => (
                      <button
                        key={question}
                        onClick={() => handleExample(question)}
                        className="rounded-md border border-blue-500/30 bg-blue-500/5 px-2 py-0.5 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="mb-4">
              <ErrorBanner
                message={error}
                onRetry={lastQuery ? () => runSearch(lastQuery, results?.page ?? 1) : undefined}
              />
            </div>
          )}

          {!loading && results && results.results.length === 0 && (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No results found"
              description={`No ${entityLabel(results.entity).toLowerCase()} matched: "${lastQuery}"`}
            />
          )}

          {!loading && results && results.results.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-sm text-foreground">
                  Showing{" "}
                  <span className="font-medium">{results.total}</span>{" "}
                  {entityLabel(results.entity).toLowerCase()}
                </p>
                <div className="flex items-center gap-1.5 ml-auto">
                  {results.toolsCalled.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ))}
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {results.latencyMs}ms
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {results.modelId} / {results.promptVersion}
                  </span>
                </div>
              </div>

              {results.suggestedFilters.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Suggested:
                  </span>
                  {results.suggestedFilters.map((sf) => (
                    <button
                      key={sf.value}
                      onClick={() => toggleFilter(sf.value)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                        activeFilters.includes(sf.value)
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {sf.label}
                    </button>
                  ))}
                </div>
              )}

              {activeFilters.length > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeFilters.map((f) => (
                      <button
                        key={f}
                        onClick={() => toggleFilter(f)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 hover:bg-secondary transition-colors"
                      >
                        {f}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5">
                {results.results.map((record) => (
                  <ResultCard
                    key={record.id}
                    record={record}
                    selected={selectedResult?.id === record.id}
                    onSelect={setSelectedResult}
                  />
                ))}
              </div>

              {results.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] font-mono uppercase tracking-[0.1em]"
                    onClick={() => runSearch(lastQuery, results.page - 1)}
                    disabled={results.page <= 1 || loading}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Prev
                  </Button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Page {results.page} of {results.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] font-mono uppercase tracking-[0.1em]"
                    onClick={() => runSearch(lastQuery, results.page + 1)}
                    disabled={results.page >= results.totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

          {showEmptyState && (
            <EmptyState
              icon={<Search className="h-10 w-10" />}
              title="Poseidon Search"
              description="Ask a natural-language question across fleet data, documents, reports, and audits."
            />
          )}
        </div>
      </div>

      {/* Right detail panel */}
      {selectedResult && (
        <aside className="w-80 shrink-0 border-l border-border bg-card flex-col hidden lg:flex min-h-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = entityIcon(selectedResult.entity);
                return <Icon className="h-4 w-4 text-muted-foreground" />;
              })()}
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground font-semibold">
                Result Details
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedResult(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
            <p className="text-xs font-medium text-foreground leading-snug">{selectedResult.title}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {entityLabel(selectedResult.entity)} · {selectedResult.id}
            </p>
            {selectedResult.summary && (
              <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                {selectedResult.summary}
              </p>
            )}
            <dl className="mt-3 space-y-2.5">
              {Object.entries(selectedResult)
                .filter(([k, v]) => {
                  if (k === "deepLink") return false;
                  if (v === null || v === undefined) return false;
                  if (typeof v === "object") return false;
                  if (v === "") return false;
                  return true;
                })
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatKey(key)}
                    </dt>
                    <dd className="text-xs text-foreground/90 mt-0.5 break-words">
                      {formatDetailValue(key, value)}
                    </dd>
                  </div>
                ))}
            </dl>
            {selectedResult.deepLink && (
              <div className="mt-4">
                <Link
                  href={selectedResult.deepLink.path}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-primary hover:bg-secondary transition-colors"
                >
                  {selectedResult.deepLink.label}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}


