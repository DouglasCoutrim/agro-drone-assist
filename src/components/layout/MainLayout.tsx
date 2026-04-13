import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block sticky top-0 h-screen z-50">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <MobileHeader />

        <main className="flex-1 overflow-y-auto px-4 pt-[calc(var(--header-height)+16px)] pb-[calc(var(--bottom-nav-height)+24px)] lg:pt-8 lg:pb-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
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
