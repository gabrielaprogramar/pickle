import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createConversationService } from "../conversation-service";

describe("ConversationService", () => {
  const mockConversationRepo = {
    findById: async (id: string) => id === "c1" ? { id: "c1", user_id: "u1", title: "Test", model_id: "mock", prompt_version: "1.0", status: "ACTIVE", organization_id: null, metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } : null,
    listByUser: async () => [{ id: "c1", user_id: "u1", title: "Test", model_id: "mock", prompt_version: "1.0", status: "ACTIVE", organization_id: null, metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    listActiveByUser: async () => [],
    insert: async (input: any) => ({ id: "c-new", ...input, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    update: async (id: string, changes: any) => ({ id, ...changes, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    archive: async (id: string) => ({ id, status: "ARCHIVED", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    delete: async () => {},
  };

  const mockMessageRepo = {
    findById: async () => null,
    listByConversation: async () => [],
    insert: async (input: any) => ({ id: "m-new", ...input, created_at: new Date().toISOString() }),
    insertBatch: async (msgs: any) => msgs.map((m: any, i: number) => ({ id: `m-${i}`, ...m, created_at: new Date().toISOString() })),
    delete: async () => {},
    deleteByConversation: async () => {},
  };

  const mockToolCallRepo = {
    findById: async () => null,
    listByConversation: async () => [],
    listByToolName: async () => [],
    insert: async (input: any) => ({ id: "tc-new", ...input, created_at: new Date().toISOString() }),
  };

  it("creates a new conversation", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const conv = await svc.createConversation({ user_id: "u1", title: "New Chat" });
    expect(conv.id).toBe("c-new");
    expect(conv.title).toBe("New Chat");
  });

  it("lists conversations for a user", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const list = await svc.listConversations("u1");
    expect(list.length).toBe(1);
  });

  it("adds a message to a conversation", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const msg = await svc.addMessage("c1", { conversation_id: "c1", role: "user", content: "Hello" });
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello");
  });

  it("getConversationContext returns conversation with messages", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const ctx = await svc.getConversationContext("c1");
    expect(ctx.conversationId).toBe("c1");
    expect(ctx.userId).toBe("u1");
    expect(ctx.messages.length).toBe(0);
  });

  it("archives a conversation", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const archived = await svc.archiveConversation("c1");
    expect(archived.status).toBe("ARCHIVED");
  });

  it("records a tool call", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const record = await svc.recordToolCall({ conversation_id: "c1", tool_name: "get_vessel_compliance_score", tool_input: {} });
    expect(record.tool_name).toBe("get_vessel_compliance_score");
  });

  it("getToolCallHistory returns calls for conversation", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const history = await svc.getToolCallHistory("c1");
    expect(history.length).toBe(0);
  });

  it("getConversation returns null for unknown id", async () => {
    const svc = createConversationService({ conversationRepo: mockConversationRepo as any, messageRepo: mockMessageRepo as any, toolCallRepo: mockToolCallRepo as any });
    const conv = await svc.getConversation("nonexistent");
    expect(conv).toBeNull();
  });
});

run();
