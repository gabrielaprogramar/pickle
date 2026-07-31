import type { DeadlineInfo } from "./types";

export function formatDeadlineTemplate(info: DeadlineInfo): { subject: string; html: string; text: string } {
  const subject = `[${info.status}] ${info.label} — ${info.days_remaining} day(s) remaining`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: ${info.status === "OVERDUE" ? "#dc2626" : info.status === "URGENT" ? "#ea580c" : "#2563eb"};">${info.label}</h2>
      <p><strong>Due:</strong> ${info.due_date}</p>
      <p><strong>Days Remaining:</strong> ${info.days_remaining}</p>
      <p><strong>Status:</strong> ${info.status}</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Poseidon Ledger — Compliance Deadline Alert</p>
    </div>
  `.trim();

  const text = `${info.label}\nDue: ${info.due_date}\nDays remaining: ${info.days_remaining}\nStatus: ${info.status}`;

  return { subject, html, text };
}

export function formatComplianceTemplate(
  severity: string,
  vesselName: string,
  message: string,
): { subject: string; html: string; text: string } {
  const subject = `[${severity}] Compliance Alert — ${vesselName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: ${severity === "CRITICAL" ? "#dc2626" : severity === "HIGH" ? "#ea580c" : "#2563eb"};">Compliance Alert — ${vesselName}</h2>
      <p>${message}</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Poseidon Ledger — Compliance Monitoring</p>
    </div>
  `.trim();

  const text = `Compliance Alert — ${vesselName}\n${message}`;

  return { subject, html, text };
}

export function formatReportTemplate(
  reportType: string,
  vesselName: string,
  year: number,
): { subject: string; html: string; text: string } {
  const subject = `Report Generated — ${reportType} — ${vesselName} (${year})`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2>Report Generated</h2>
      <p><strong>Type:</strong> ${reportType}</p>
      <p><strong>Vessel:</strong> ${vesselName}</p>
      <p><strong>Year:</strong> ${year}</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Poseidon Ledger — Compliance Reports</p>
    </div>
  `.trim();

  const text = `Report Generated\nType: ${reportType}\nVessel: ${vesselName}\nYear: ${year}`;

  return { subject, html, text };
}

export function formatBdnTemplate(
  event: string,
  vesselName: string,
  bdnFilename: string,
): { subject: string; html: string; text: string } {
  const subject = `BDN ${event} — ${bdnFilename}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2>BDN ${event}</h2>
      <p><strong>Vessel:</strong> ${vesselName}</p>
      <p><strong>File:</strong> ${bdnFilename}</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Poseidon Ledger — BDN Ingestion</p>
    </div>
  `.trim();

  const text = `BDN ${event}\nVessel: ${vesselName}\nFile: ${bdnFilename}`;

  return { subject, html, text };
}

export function formatSoxTemplate(
  severity: string,
  vesselName: string,
  message: string,
): { subject: string; html: string; text: string } {
  const subject = `[${severity}] SOx ECA — ${vesselName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2 style="color: ${severity === "CRITICAL" ? "#dc2626" : severity === "HIGH" ? "#ea580c" : "#2563eb"};">SOx ECA Watch — ${vesselName}</h2>
      <p>${message}</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Poseidon Ledger — MARPOL Annex VI Med SOx ECA monitoring</p>
    </div>
  `.trim();

  const text = `SOx ECA Watch — ${vesselName}\n${message}`;

  return { subject, html, text };
}

export function formatVerifierPackageTemplate(
  vesselName: string,
  year: number,
  status: string,
): { subject: string; html: string; text: string } {
  const subject = `Verifier Package ${status} — ${vesselName} (${year})`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <h2>Verifier Package ${status}</h2>
      <p><strong>Vessel:</strong> ${vesselName}</p>
      <p><strong>Year:</strong> ${year}</p>
      <p><strong>Status:</strong> ${status}</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Poseidon Ledger — Verifier Package</p>
    </div>
  `.trim();

  const text = `Verifier Package ${status}\nVessel: ${vesselName}\nYear: ${year}\nStatus: ${status}`;

  return { subject, html, text };
}
