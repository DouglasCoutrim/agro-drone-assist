import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavSection } from './navConfig';
function Module({section,onNavigate}: {section: NavSection; onNavigate?: () => void}) {
 const {pathname} = useLocation();
 const active = section.items.some(i => i.href === pathname);
 const [expanded, setExpanded] = useState<boolean | null>(null);
 const open = expanded ?? active;
 const Icon = section.items[0]?.icon;
 return <div className="py-0.5">
  <Button variant="ghost" className={cn('h-10 w-full justify-start px-3 font-medium',active ? 'bg-sidebar-accent text-primary' : 'text-sidebar-foreground')} aria-expanded={open} onClick={() => setExpanded(!open)}>
   {Icon && <Icon className="h-4 w-4" />}<span className="flex-1 text-left">{section.title}</span><ChevronDown className={cn('h-3.5 w-3.5 transition-transform',open && 'rotate-180')} />
  </Button>
  {open && <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">{section.items.map(item => <Button asChild key={item.href} variant="ghost" className={cn('h-auto min-h-9 w-full justify-start whitespace-normal px-3 py-2 text-left text-[13px] font-normal',pathname === item.href ? 'bg-primary/10 text-primary font-semibold' : 'text-sidebar-foreground hover:bg-sidebar-accent')}><Link to={item.href} onClick={onNavigate}>{item.title}</Link></Button>)}</div>}
 </div>;
}
export function NavModules({sections,onNavigate}: {sections: NavSection[]; onNavigate?: () => void}) {
 const {pathname} = useLocation();
 return <>{sections.map(section => <Module key={`${section.title}-${pathname}`} section={section} onNavigate={onNavigate} />)}</>;
}
