export function UserMessage({ content }: { readonly content: string | null }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}
