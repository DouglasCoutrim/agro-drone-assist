import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  useInactivityLogout();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block sticky top-0 h-screen z-50">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <MobileHeader />

        <main className="flex-1 overflow-y-auto px-4 pt-[calc(var(--header-height)+env(safe-area-inset-top)+16px)] pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+24px)] lg:pt-8 lg:pb-8 lg:px-8 w-full scroll-smooth">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* Global Search Overlay */}
      <GlobalSearch />
    </div>
  );
}
