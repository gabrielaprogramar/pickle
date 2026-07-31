import type { ReactNode } from "react";

interface AssistantPageContainerProps {
  readonly children: ReactNode;
}

export function AssistantPageContainer({ children }: AssistantPageContainerProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1600px] flex-col gap-4 px-4 py-5 -m-4 lg:-m-6 lg:px-6">
      {children}
    </div>
  );
}
