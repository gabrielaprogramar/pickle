export interface ChatCitation {
  source: string;
  article_section: string | null;
  excerpt: string;
}

export interface ChatToolCall {
  toolName: string;
  success: boolean;
  latencyMs: number;
}

export type ChatToolStatus = "success" | "error" | "partial";
