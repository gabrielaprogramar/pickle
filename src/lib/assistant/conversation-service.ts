import type {
  AssistantConversationRow,
  AssistantConversationInsert,
  AssistantMessageRow,
  AssistantMessageInsert,
  AssistantToolCallRow,
  AssistantToolCallInsert,
  AssistantConversationRepository,
  AssistantMessageRepository,
  AssistantToolCallRepository,
} from "@/lib/supabase";
import type { ConversationContext } from "./types";

export interface ConversationServiceOptions {
  readonly conversationRepo: AssistantConversationRepository;
  readonly messageRepo: AssistantMessageRepository;
  readonly toolCallRepo: AssistantToolCallRepository;
}

export interface ConversationService {
  createConversation(input: AssistantConversationInsert): Promise<AssistantConversationRow>;
  getConversation(id: string): Promise<AssistantConversationRow | null>;
  listConversations(userId: string): Promise<ReadonlyArray<AssistantConversationRow>>;
  updateConversation(id: string, changes: Partial<AssistantConversationInsert>): Promise<AssistantConversationRow>;
  archiveConversation(id: string): Promise<AssistantConversationRow>;
  deleteConversation(id: string): Promise<void>;

  addMessage(conversationId: string, message: AssistantMessageInsert): Promise<AssistantMessageRow>;
  getMessages(conversationId: string): Promise<ReadonlyArray<AssistantMessageRow>>;
  getConversationContext(conversationId: string): Promise<ConversationContext>;
  clearMessages(conversationId: string): Promise<void>;

  recordToolCall(call: AssistantToolCallInsert): Promise<AssistantToolCallRow>;
  getToolCallHistory(conversationId: string): Promise<ReadonlyArray<AssistantToolCallRow>>;
}

export function createConversationService(opts: ConversationServiceOptions): ConversationService {
  return {
    async createConversation(input: AssistantConversationInsert): Promise<AssistantConversationRow> {
      return opts.conversationRepo.insert(input);
    },

    async getConversation(id: string): Promise<AssistantConversationRow | null> {
      return opts.conversationRepo.findById(id);
    },

    async listConversations(userId: string): Promise<ReadonlyArray<AssistantConversationRow>> {
      return opts.conversationRepo.listByUser(userId);
    },

    async updateConversation(id: string, changes: Partial<AssistantConversationInsert>): Promise<AssistantConversationRow> {
      return opts.conversationRepo.update(id, changes);
    },

    async archiveConversation(id: string): Promise<AssistantConversationRow> {
      return opts.conversationRepo.archive(id);
    },

    async deleteConversation(id: string): Promise<void> {
      await opts.conversationRepo.delete(id);
    },

    async addMessage(conversationId: string, message: AssistantMessageInsert): Promise<AssistantMessageRow> {
      return opts.messageRepo.insert({ ...message, conversation_id: conversationId });
    },

    async getMessages(conversationId: string): Promise<ReadonlyArray<AssistantMessageRow>> {
      return opts.messageRepo.listByConversation(conversationId);
    },

    async getConversationContext(conversationId: string): Promise<ConversationContext> {
      const conversation = await opts.conversationRepo.findById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      const messages = await opts.messageRepo.listByConversation(conversationId);
      return {
        conversationId: conversation.id,
        userId: conversation.user_id,
        organizationId: conversation.organization_id,
        messages,
        metadata: conversation.metadata,
      };
    },

    async clearMessages(conversationId: string): Promise<void> {
      await opts.messageRepo.deleteByConversation(conversationId);
    },

    async recordToolCall(call: AssistantToolCallInsert): Promise<AssistantToolCallRow> {
      return opts.toolCallRepo.insert(call);
    },

    async getToolCallHistory(conversationId: string): Promise<ReadonlyArray<AssistantToolCallRow>> {
      return opts.toolCallRepo.listByConversation(conversationId);
    },
  };
}
