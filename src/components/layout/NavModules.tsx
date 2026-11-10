import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavSection } from './navConfig';

function Module({ section, onNavigate, dark }: { section: NavSection; onNavigate?: () => void; dark?: boolean }) {
  const { pathname } = useLocation();
  const active = section.items.some(i => i.href === pathname);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? active;
  const Icon = section.items[0]?.icon;
  const base = dark ? 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground' : 'text-foreground hover:bg-muted';
  return (
    <div className="py-0.5">
      <Button variant="ghost" className={cn('h-10 w-full justify-start gap-3 rounded-lg px-3 font-medium', active ? (dark ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'bg-primary/10 text-primary') : base)} aria-expanded={open} onClick={() => setExpanded(!open)}>
        {Icon && <Icon className="h-[18px] w-[18px]" />}
        <span className="flex-1 text-left">{section.title}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div className={cn('ml-5 mt-1 space-y-0.5 border-l pl-2', dark ? 'border-sidebar-border' : 'border-border')}>
          {section.items.map(item => {
            const on = pathname === item.href;
            return (
              <Button asChild key={item.href} variant="ghost" className={cn('h-auto min-h-9 w-full justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-[13px] font-normal',
                on ? (dark ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground' : 'bg-primary/10 text-primary font-semibold') : base)}>
                <Link to={item.href} onClick={onNavigate}>{item.title}</Link>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NavModules({ sections, onNavigate, dark }: { sections: NavSection[]; onNavigate?: () => void; dark?: boolean }) {
  const { pathname } = useLocation();
  return <>{sections.map(section => <Module key={`${section.title}-${pathname}`} section={section} onNavigate={onNavigate} dark={dark} />)}</>;
}
