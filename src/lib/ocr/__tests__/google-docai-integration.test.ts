import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createGoogleDocAiOcrProvider } from "../google-docai";
import type { GoogleDocAiConfig } from "../google-docai";
import {
  GoogleOcrAuthError,
  GoogleOcrApiError,
  GoogleOcrRateLimitError,
} from "../errors";
import * as fs from "fs";
import * as path from "path";

const credentialsJson = fs.readFileSync(
  path.resolve(__dirname, "fixtures/test-credentials.json"),
  "utf-8",
);
const credentials = JSON.parse(credentialsJson);

const config: GoogleDocAiConfig = {
  projectId: "integration-test",
  location: "us",
  processorId: "test-processor",
  credentials: {
    type: credentials.type,
    project_id: credentials.project_id,
    private_key_id: credentials.private_key_id,
    private_key: credentials.private_key,
    client_email: credentials.client_email,
    client_id: credentials.client_id,
    auth_uri: credentials.auth_uri,
    token_uri: credentials.token_uri,
  },
};

function buildResponse(status: number, body: unknown): Response {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Map() as unknown as Headers,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => bodyStr,
  } as Response;
}

describe("Google DocAI OCR — integration (isolated fetch mock)", () => {
  it("extracts text from a PDF", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(200, {
          document: {
            text: "BUNKER DELIVERY NOTE\nVessel: MV Test\nIMO: 1234567\nPort: Rotterdam",
            pages: [{ paragraphs: [] }],
            entities: [
              { type: "vesselName", mentionText: "MV Test", confidence: 0.95 },
              { type: "imoNumber", mentionText: "1234567", confidence: 0.99 },
              { type: "port", mentionText: "Rotterdam", confidence: 0.90 },
            ],
          },
        });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    const result = await provider.extract(
      Buffer.from("%PDF-1.4 fake pdf content"),
      "application/pdf",
      "imo_dcs",
    );

    expect(result.rawText).toContainString("BUNKER DELIVERY NOTE");
    expect(result.rawText).toContainString("MV Test");
    expect(result.extractedData["vesselName"]).toBe("MV Test");
    expect(result.extractedData["imoNumber"]).toBe("1234567");
    expect(result.extractedData["port"]).toBe("Rotterdam");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("extracts text from an image", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(200, {
          document: {
            text: "CERTIFICATE OF INSURANCE\nVessel: ImageShip",
            pages: [],
            entities: [{ type: "vesselName", mentionText: "ImageShip", confidence: 0.88 }],
          },
        });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    const result = await provider.extract(Buffer.from("fake png bytes"), "image/png", "certificate");

    expect(result.rawText).toContainString("ImageShip");
    expect(result.extractedData["vesselName"]).toBe("ImageShip");
  });

  it("extracts text from documents with no entities", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(200, { document: { text: "No entities here", pages: [] } });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "other");

    expect(result.rawText).toBe("No entities here");
    expect(result.extractedData["fullText"]).toBe("No entities here");
    expect(result.confidence).toBe(0.5);
  });

  it("extracts form fields when entities are absent", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(200, {
          document: {
            text: "Form data",
            pages: [{
              formFields: [
        { fieldName: { textAnchor: { content: "Vessel Name" } }, fieldValue: { textAnchor: { content: "FormShip" } } },
        { fieldName: { textAnchor: { content: "IMO Number" } }, fieldValue: { textAnchor: { content: "1112223" } } },
              ],
            }],
            entities: [],
          },
        });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "certificate");

    expect(result.extractedData["form_Vessel Name"]).toBe("FormShip");
    expect(result.extractedData["form_IMO Number"]).toBe("1112223");
  });

  it("extracts IMO number from full text when no entities", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(200, {
          document: { text: "Vessel: Test\nIMO: 7654321\n", pages: [] },
        });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "imo_dcs");

    expect(result.extractedData["imoNumber"]).toBe("7654321");
    expect(result.extractedData["vesselName"]).toBe("Test");
  });

  it("throws GoogleOcrAuthError on 401", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(401, { error: "Unauthorized" });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);

    try {
      await provider.extract(Buffer.from("test"), "application/pdf", "report");
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof GoogleOcrAuthError).toBe(true);
    }
  });

  it("throws GoogleOcrAuthError on 403", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(403, { error: "Forbidden" });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);

    try {
      await provider.extract(Buffer.from("test"), "application/pdf", "eu_mrv");
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof GoogleOcrAuthError).toBe(true);
    }
  });

  it("throws GoogleOcrRateLimitError on 429", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(429, { error: "Rate limited" });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);

    try {
      await provider.extract(Buffer.from("test"), "application/pdf", "logbook");
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof GoogleOcrRateLimitError).toBe(true);
    }
  });

  it("throws GoogleOcrApiError on 500 server error", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(500, { error: "Internal" });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);

    try {
      await provider.extract(Buffer.from("test"), "application/pdf", "correspondence");
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof GoogleOcrApiError).toBe(true);
      if (e instanceof GoogleOcrApiError) {
        expect(e.status).toBe(500);
      }
    }
  });

  it("retries on 503 and eventually succeeds", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        if (docCalls <= 2) return buildResponse(503, "Service Unavailable");
        return buildResponse(200, {
          document: {
            text: "Retried OK",
            pages: [],
            entities: [{ type: "test", mentionText: "ok", confidence: 0.9 }],
          },
        });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, {
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 50,
    }, fetch);

    const result = await provider.extract(Buffer.from("test"), "application/pdf", "imo_dcs");
    expect(result.rawText).toBe("Retried OK");
  });

  it("gives up after max retries on persistent 503", async () => {
    let docCalls = 0;
    const fetch: typeof globalThis.fetch = async (url) => {
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (`${url}`.includes("documentai")) {
        docCalls++;
        return buildResponse(503, "Service Unavailable");
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, {
      maxRetries: 1,
      baseDelayMs: 10,
      maxDelayMs: 50,
    }, fetch);

    try {
      await provider.extract(Buffer.from("test"), "application/pdf", "report");
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof GoogleOcrApiError).toBe(true);
    }
  });

  it("sends skipHumanReview: true in request body", async () => {
    let requestBody: string | undefined;
    const fetch: typeof globalThis.fetch = async (url, opts) => {
      if (`${url}`.includes("documentai")) {
        requestBody = opts?.body as string | undefined;
        return buildResponse(200, { document: { text: "", pages: [], entities: [] } });
      }
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    await provider.extract(Buffer.from("test"), "application/pdf", "imo_dcs");

    const body = JSON.parse(requestBody ?? "{}");
    expect(body.skipHumanReview).toBe(true);
  });

  it("sends document content as base64-encoded rawDocument", async () => {
    let requestBody: string | undefined;
    const fetch: typeof globalThis.fetch = async (url, opts) => {
      if (`${url}`.includes("documentai")) {
        requestBody = opts?.body as string | undefined;
        return buildResponse(200, { document: { text: "", pages: [], entities: [] } });
      }
      if (`${url}`.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    const content = Buffer.from("Hello Document AI");
    await provider.extract(content, "application/pdf", "other");

    const body = JSON.parse(requestBody ?? "{}");
    expect(body.rawDocument.content).toBe(content.toString("base64"));
    expect(body.rawDocument.mimeType).toBe("application/pdf");
  });

  it("builds correct REST API URL", async () => {
    const requestUrls: string[] = [];
    const fetch: typeof globalThis.fetch = async (url) => {
      const urlStr = `${url}`;
      requestUrls.push(urlStr);
      if (urlStr.includes("oauth2")) {
        return buildResponse(200, { access_token: "token", expires_in: 3600 });
      }
      if (urlStr.includes("documentai")) {
        return buildResponse(200, { document: { text: "", pages: [], entities: [] } });
      }
      return buildResponse(200, {});
    };

    const provider = createGoogleDocAiOcrProvider(config, { log: () => {} }, undefined, fetch);
    await provider.extract(Buffer.from("test"), "application/pdf", "imo_dcs");

    const docUrl = requestUrls.find((u) => u.includes("documentai.googleapis.com"));
    expect(docUrl).toBeTruthy();
    expect(docUrl).toContainString("us-documentai.googleapis.com");
    expect(docUrl).toContainString("/projects/integration-test/locations/us/processors/test-processor:process");
  });
});

run();
