export default function HomePage() {
  return (
    <div>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
        Maritime ESG Compliance Intelligence
      </h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        Manage vessel compliance documents, track emissions, and monitor regulatory status.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Documents</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Upload and manage compliance documents including BDN, CII, EU-ETS, and FuelEU reports.
          </p>
          <a
            href="/documents"
            style={{
              display: "inline-block",
              marginTop: "12px",
              padding: "8px 16px",
              backgroundColor: "#1a2332",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            View Documents
          </a>
        </div>
        <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Coming Soon</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Vessel tracking, voyage history, and AIS position monitoring.
          </p>
        </div>
      </div>
    </div>
  );
}
