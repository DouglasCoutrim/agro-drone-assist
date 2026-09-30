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
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block sticky top-0 h-[100dvh] z-50">
        <Sidebar />
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <MobileHeader />

        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full scroll-smooth pt-[var(--header-height)] pb-[calc(var(--bottom-nav-height)+5rem)] lg:pt-0 lg:pb-0 overscroll-contain">
          <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 animate-in fade-in duration-500">
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
