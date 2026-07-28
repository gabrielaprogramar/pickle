import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Poseidon Ledger",
  description: "Maritime ESG Compliance Intelligence Platform",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: 0 }}>
        <nav
          style={{
            backgroundColor: "#1a2332",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <span style={{ color: "#4fc3f7", fontWeight: "bold", fontSize: "18px" }}>
            Poseidon Ledger
          </span>
          <a href="/" style={{ color: "#ccc", textDecoration: "none" }}>Dashboard</a>
          <a href="/documents" style={{ color: "#ccc", textDecoration: "none" }}>Documents</a>
        </nav>
        <main style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
