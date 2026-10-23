import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
interface KpiCardProps {
 label: string; value: string | number; trend?: {value:number;label:string} | string;
 icon: LucideIcon; color: 'blue'|'green'|'yellow'|'red'|'purple'|'orange'; onClick?: () => void; className?: string; delay?: number;
}
const tones = {blue:'kpi-icon-blue',green:'kpi-icon-green',yellow:'kpi-icon-orange',red:'kpi-icon-red',purple:'kpi-icon-purple',orange:'kpi-icon-orange'};
export function KpiCard({label,value,trend,icon:Icon,color,onClick,className}: KpiCardProps) {
 return <div className={cn('min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-soft',onClick && 'cursor-pointer hover:border-primary/30',className)} onClick={onClick}>
  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs leading-relaxed text-muted-foreground">{label}</p><p className="mt-2 break-words text-xl font-semibold tabular-nums">{value}</p></div><div className={cn('shrink-0 rounded-lg p-2.5',tones[color])}><Icon className="h-5 w-5" /></div></div>
  {trend && <p className="mt-3 text-xs text-muted-foreground">{typeof trend === 'string' ? trend : <><span className={trend.value > 0 ? 'text-success' : 'text-destructive'}>{trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span> {trend.label}</>}</p>}
 </div>;
}
