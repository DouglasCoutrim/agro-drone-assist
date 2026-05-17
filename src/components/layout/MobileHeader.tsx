import { Bell, Search } from "lucide-react";
import logo from "@/assets/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function MobileHeader() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [user]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-card border-b border-border flex items-center justify-between px-4 z-[100] lg:hidden" style={{ boxShadow: "var(--shadow-xs)" }}>
      <div className="flex items-center">
        <img src={logo} alt="LivreOS" className="h-8 w-auto" />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button className="w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground flex items-center justify-center relative transition-all hover:bg-background hover:text-foreground">
          <Bell size={16} />
        </button>
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center ml-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary">{user?.email?.charAt(0)?.toUpperCase() || "U"}</span>
          )}
        </div>
      </div>
    </header>
  );
}
