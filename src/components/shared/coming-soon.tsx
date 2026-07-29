import { Construction } from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface ComingSoonProps {
  readonly module: string;
  readonly description: string;
}

export function ComingSoon({ module, description }: ComingSoonProps) {
  return (
    <div>
      <PageHeader
        title={module}
        description={description}
      />
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Construction className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          This module is under development
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60 max-w-md">
          {module} will be available in a future release. The architecture
          is prepared — sidebar navigation and route structure are in place.
        </p>
      </div>
    </div>
  );
}
