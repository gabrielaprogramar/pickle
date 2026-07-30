import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  formatDeadlineTemplate,
  formatComplianceTemplate,
  formatReportTemplate,
  formatBdnTemplate,
  formatVerifierPackageTemplate,
} from "../templates";
import type { DeadlineInfo } from "../types";

describe("Email Templates", () => {
  describe("formatDeadlineTemplate", () => {
    it("formats an overdue deadline with critical styling", () => {
      const info: DeadlineInfo = {
        deadline_type: "ets_submission",
        label: "EU ETS Annual Submission",
        due_date: "2025-03-31",
        days_remaining: -5,
        status: "OVERDUE",
      };

      const result = formatDeadlineTemplate(info);
      expect(result.subject).toContainString("[OVERDUE]");
      expect(result.subject).toContainString("EU ETS Annual Submission");
      expect(result.subject).toContainString("-5");
      expect(result.html).toContainString("#dc2626");
      expect(result.text).toContainString("OVERDUE");
    });

    it("formats an urgent deadline with orange styling", () => {
      const info: DeadlineInfo = {
        deadline_type: "fueleu_submission",
        label: "FuelEU Submission",
        due_date: "2025-02-15",
        days_remaining: 7,
        status: "URGENT",
      };

      const result = formatDeadlineTemplate(info);
      expect(result.subject).toContainString("[URGENT]");
      expect(result.html).toContainString("#ea580c");
    });

    it("formats a warning deadline with blue styling", () => {
      const info: DeadlineInfo = {
        deadline_type: "mrv_verification",
        label: "MRV Verification Deadline",
        due_date: "2025-06-30",
        days_remaining: 60,
        status: "WARNING",
      };

      const result = formatDeadlineTemplate(info);
      expect(result.subject).toContainString("[WARNING]");
      expect(result.html).toContainString("#2563eb");
    });
  });

  describe("formatComplianceTemplate", () => {
    it("formats a critical compliance alert", () => {
      const result = formatComplianceTemplate("CRITICAL", "Test Vessel", "FuelEU deficit detected");
      expect(result.subject).toContainString("[CRITICAL]");
      expect(result.subject).toContainString("Test Vessel");
      expect(result.html).toContainString("#dc2626");
      expect(result.text).toContainString("FuelEU deficit detected");
    });

    it("formats a high severity compliance alert", () => {
      const result = formatComplianceTemplate("HIGH", "Vessel X", "ISCC certificate missing");
      expect(result.subject).toContainString("[HIGH]");
      expect(result.html).toContainString("#ea580c");
    });

    it("formats an info compliance alert", () => {
      const result = formatComplianceTemplate("INFO", "Vessel Y", "Routine check passed");
      expect(result.subject).toContainString("[INFO]");
      expect(result.html).toContainString("#2563eb");
    });
  });

  describe("formatReportTemplate", () => {
    it("formats a report generated notification", () => {
      const result = formatReportTemplate("THETIS-MRV", "Test Vessel", 2025);
      expect(result.subject).toContainString("Report Generated");
      expect(result.subject).toContainString("THETIS-MRV");
      expect(result.subject).toContainString("Test Vessel");
      expect(result.subject).toContainString("(2025)");
      expect(result.html).toContainString("THETIS-MRV");
      expect(result.text).toContainString("2025");
    });
  });

  describe("formatBdnTemplate", () => {
    it("formats a BDN accepted notification", () => {
      const result = formatBdnTemplate("Accepted", "Test Vessel", "bdn-2025-01.pdf");
      expect(result.subject).toContainString("BDN Accepted");
      expect(result.subject).toContainString("bdn-2025-01.pdf");
      expect(result.html).toContainString("Test Vessel");
    });
  });

  describe("formatVerifierPackageTemplate", () => {
    it("formats a verifier package generated notification", () => {
      const result = formatVerifierPackageTemplate("Test Vessel", 2025, "Generated");
      expect(result.subject).toContainString("Verifier Package Generated");
      expect(result.subject).toContainString("Test Vessel");
      expect(result.subject).toContainString("(2025)");
      expect(result.html).toContainString("Generated");
    });

    it("formats a verifier package failed notification", () => {
      const result = formatVerifierPackageTemplate("Test Vessel", 2025, "Failed");
      expect(result.subject).toContainString("Verifier Package Failed");
    });
  });
});

run();
