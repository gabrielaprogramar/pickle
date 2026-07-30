import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { validateAttachment, computeSha256 } from "../attachment";
import { MAX_ATTACHMENT_SIZE } from "../types";

describe("computeSha256", () => {
  it("returns deterministic hex hash for same content", () => {
    const buf1 = Buffer.from("test content");
    const buf2 = Buffer.from("test content");
    expect(computeSha256(buf1)).toBe(computeSha256(buf2));
  });

  it("returns different hash for different content", () => {
    const buf1 = Buffer.from("content a");
    const buf2 = Buffer.from("content b");
    const hash1 = computeSha256(buf1);
    const hash2 = computeSha256(buf2);
    expect(hash1 === hash2).toBe(false);
  });

  it("returns 64-character hex string", () => {
    const hash = computeSha256(Buffer.from("hello"));
    expect(hash.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });
});

describe("validateAttachment", () => {
  it("accepts valid PDF attachment", () => {
    const result = validateAttachment({
      filename: "bdn.pdf",
      content: Buffer.from("pdf content"),
      mimeType: "application/pdf",
      size: 100,
    });
    expect(result.valid).toBe(true);
    expect(result.rejectionReason).toBeNull();
  });

  it("accepts valid JPEG attachment", () => {
    const result = validateAttachment({
      filename: "photo.jpg",
      content: Buffer.from("jpeg content"),
      mimeType: "image/jpeg",
      size: 200,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid PNG attachment", () => {
    const result = validateAttachment({
      filename: "image.png",
      content: Buffer.from("png content"),
      mimeType: "image/png",
      size: 150,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid TIFF attachment", () => {
    const result = validateAttachment({
      filename: "scan.tiff",
      content: Buffer.from("tiff content"),
      mimeType: "image/tiff",
      size: 300,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects unsupported MIME type", () => {
    const result = validateAttachment({
      filename: "data.xlsx",
      content: Buffer.from("xlsx content"),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 500,
    });
    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toBeTruthy();
    if (result.rejectionReason) {
      expect(result.rejectionReason.indexOf("Unsupported MIME type") >= 0).toBe(true);
    }
  });

  it("rejects file exceeding max size", () => {
    const result = validateAttachment({
      filename: "huge.pdf",
      content: Buffer.alloc(MAX_ATTACHMENT_SIZE + 1),
      mimeType: "application/pdf",
      size: MAX_ATTACHMENT_SIZE + 1,
    });
    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toBeTruthy();
    if (result.rejectionReason) {
      expect(result.rejectionReason.indexOf("File too large") >= 0).toBe(true);
    }
  });

  it("rejects unsupported file extension despite valid MIME type", () => {
    const result = validateAttachment({
      filename: "document.exe",
      content: Buffer.from("exe content"),
      mimeType: "application/pdf",
      size: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toBeTruthy();
    if (result.rejectionReason) {
      expect(result.rejectionReason.indexOf("Unsupported file extension") >= 0).toBe(true);
    }
  });

  it("accepts file with no extension despite valid MIME type", () => {
    const result = validateAttachment({
      filename: "noextension",
      content: Buffer.from("content"),
      mimeType: "application/pdf",
      size: 100,
    });
    expect(result.valid).toBe(true);
  });

  it("computes correct SHA-256 for valid attachment", () => {
    const content = Buffer.from("sha test content");
    const result = validateAttachment({
      filename: "test.pdf",
      content,
      mimeType: "application/pdf",
      size: content.length,
    });
    expect(result.sha256).toBe(computeSha256(content));
  });
});

run();
