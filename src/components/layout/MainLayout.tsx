import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { ReloadPrompt } from "./ReloadPrompt";

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

      {/* Main Content Wrapper */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <MobileHeader />

        <main className="flex-1 overflow-y-auto w-full scroll-smooth pt-[var(--header-height)] pb-[var(--bottom-nav-height)] lg:pt-0 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* Global Search Overlay */}
      <GlobalSearch />

      {/* PWA Update Prompt */}
      <ReloadPrompt />
    </div>
  );
}
