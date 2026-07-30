"use client";

import { useEffect, useState } from "react";
import { apiSuccess } from "@/app/api/_lib/http";

interface ReportSummary {
  readonly id: string;
  readonly report_type: string;
  readonly title: string;
  readonly reporting_year: number;
  readonly status: string;
  readonly generated_at: string | null;
}

export function ReportsList() {
  const [reports, setReports] = useState<ReadonlyArray<ReportSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.reports) {
          setReports(json.data.reports);
        } else {
          setError(json.error?.message ?? "Failed to load reports");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading reports…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  if (reports.length === 0) {
    return <div className="text-sm text-gray-500">No compliance reports yet.</div>;
  }

  const statusColor = (status: string): string => {
    switch (status) {
      case "GENERATED": return "text-green-600";
      case "FAILED": return "text-red-600";
      case "DRAFT": return "text-yellow-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Compliance Reports</h3>
      <div className="divide-y divide-gray-200">
        {reports.map((r) => (
          <div key={r.id} className="py-2 flex items-center justify-between">
            <div>
              <a href={`/api/reports/${r.id}`} className="text-sm text-blue-600 hover:underline">
                {r.title}
              </a>
              <span className="ml-2 text-xs text-gray-400">{r.report_type}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${statusColor(r.status)}`}>
                {r.status}
              </span>
              {r.generated_at && (
                <span className="text-xs text-gray-400">
                  {new Date(r.generated_at).toLocaleDateString()}
                </span>
              )}
              <a
                href={`/api/reports/${r.id}/download`}
                className="text-xs text-blue-500 hover:underline"
              >
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
