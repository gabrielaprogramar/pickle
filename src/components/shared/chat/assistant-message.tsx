import type { ReactNode } from "react";
import { CitationList } from "./citation-list";
import { ToolCallTrace } from "./tool-call-trace";
import type { ChatCitation, ChatToolCall, ChatToolStatus } from "./types";

export function AssistantMessage({
  content,
  citations,
  toolCalls,
  onCitationClick,
  toolStatusFn,
  renderContent,
}: {
  readonly content: string | null;
  readonly citations?: ReadonlyArray<ChatCitation>;
  readonly toolCalls?: ReadonlyArray<ChatToolCall>;
  readonly onCitationClick?: (citation: ChatCitation) => void;
  readonly toolStatusFn?: (tc: ChatToolCall) => ChatToolStatus;
  readonly renderContent?: (content: string | null) => ReactNode;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
        {renderContent ? (
          renderContent(content)
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )}
        {citations && citations.length > 0 && (
          <CitationList citations={citations} onCitationClick={onCitationClick} />
        )}
        {toolCalls && toolCalls.length > 0 && (
          <ToolCallTrace calls={toolCalls} statusFn={toolStatusFn} />
        )}
      </div>
    </div>
  );
}
