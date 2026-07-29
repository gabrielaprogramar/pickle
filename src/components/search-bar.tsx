"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface SearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onClear: () => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly isLoading?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  className,
  isLoading,
}: SearchBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 pr-8 h-8 text-xs"
          disabled={isLoading}
        />
        {value && (
          <button
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
