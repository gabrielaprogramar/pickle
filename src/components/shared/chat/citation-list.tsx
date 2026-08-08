import type { ChatCitation } from "./types";

export function CitationList({
  citations,
  onCitationClick,
}: {
  readonly citations: ReadonlyArray<ChatCitation>;
  readonly onCitationClick?: (citation: ChatCitation) => void;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        Sources
      </p>
      <div className="space-y-1">
        {citations.map((cit, i) => {
          const inner = (
            <>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                [{i + 1}]
              </span>
              <div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {cit.source}
                  {cit.article_section && <span className="opacity-70"> &mdash; {cit.article_section}</span>}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground/60 mt-0.5 line-clamp-2">
                  {cit.excerpt}
                </p>
              </div>
            </>
          );
          return onCitationClick ? (
            <button
              key={i}
              onClick={() => onCitationClick(cit)}
              className="w-full text-left flex items-start gap-1.5 hover:bg-background/50 rounded-sm px-1 py-0.5 transition-colors"
            >
              {inner}
            </button>
          ) : (
            <div key={i} className="flex items-start gap-1.5">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
