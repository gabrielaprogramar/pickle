/**
 * use-document-upload.ts — hook for uploading a document
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useCallback } from "react";

interface UploadResult {
  readonly documentId: string;
  readonly status: string;
  readonly ocrCompleted: boolean;
  readonly entityCount: number;
}

interface UseDocumentUploadResult {
  readonly upload: (input: {
    readonly file: File;
    readonly title: string;
    readonly documentType: string;
    readonly vesselId?: string;
  }) => Promise<UploadResult>;
  readonly uploading: boolean;
  readonly error: string | null;
  readonly result: UploadResult | null;
}

export function useDocumentUpload(): UseDocumentUploadResult {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = useCallback(
    async (input: {
      readonly file: File;
      readonly title: string;
      readonly documentType: string;
      readonly vesselId?: string;
    }): Promise<UploadResult> => {
      setUploading(true);
      setError(null);
      setResult(null);

      try {
        const formData = new FormData();
        formData.set("file", input.file);
        formData.set("title", input.title);
        formData.set("documentType", input.documentType);
        if (input.vesselId) {
          formData.set("vesselId", input.vesselId);
        }

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();

        if (json.success) {
          setResult(json.data);
          return json.data;
        }

        const msg = json.error?.message ?? "Upload failed";
        setError(msg);
        throw new Error(msg);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        setError(msg);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return { upload, uploading, error, result };
}
