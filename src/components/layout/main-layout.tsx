"use client";

import { usePathname } from "next/navigation";
import { AuthGate, isAuthPath } from "@/components/auth/auth-gate";
import { AppSidebar } from "./sidebar";
import { AppHeader } from "./header";

interface MainLayoutProps {
  readonly children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const bare = isAuthPath(pathname);

  return (
    <AuthGate>
      {bare ? (
        <>{children}</>
      ) : (
        <div className="flex h-screen overflow-hidden bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader />
            <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      )}
    </AuthGate>
  );
}
