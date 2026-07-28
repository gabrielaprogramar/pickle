/**
 * use-documents.ts — hook for listing documents
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface Document {
  readonly id: string;
  readonly vessel_id: string | null;
  readonly document_type: string;
  readonly status: string;
  readonly title: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly file_size: number | null;
  readonly storage_path: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface UseDocumentsOptions {
  readonly vesselId?: string;
  readonly documentType?: string;
  readonly limit?: number;
  readonly offset?: number;
}

interface UseDocumentsResult {
  readonly documents: Document[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useDocuments(opts: UseDocumentsOptions = {}): UseDocumentsResult {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts.vesselId) params.set("vesselId", opts.vesselId);
      if (opts.documentType) params.set("documentType", opts.documentType);
      if (opts.limit) params.set("limit", String(opts.limit));
      if (opts.offset) params.set("offset", String(opts.offset));

      const res = await fetch(`/api/documents?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setDocuments(json.data);
      } else {
        setError(json.error?.message ?? "Failed to fetch documents");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [opts.vesselId, opts.documentType, opts.limit, opts.offset]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}
