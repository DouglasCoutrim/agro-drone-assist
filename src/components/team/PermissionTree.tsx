import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navSections } from "@/components/layout/navConfig";
import { toggleHrefs } from "@/lib/permissionTree";

interface Props {
  roles: string[];
  blocked: string[];
  onChange: (blocked: string[]) => void;
  disabled?: boolean;
}

/** Espelha o menu principal: cada módulo e item tem um checkbox (marcado = tem acesso). */
export function PermissionTree({ roles, blocked, onChange, disabled }: Props) {
  const allowedByRole = (itemRoles: string[]) => roles.some((r) => itemRoles.includes(r));
  const allHrefs = navSections.flatMap((s) => s.items.filter((i) => allowedByRole(i.roles)).map((i) => i.href));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Acesso ao menu</p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange(toggleHrefs(blocked, allHrefs, true))}>Marcar tudo</Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange(toggleHrefs(blocked, allHrefs, false))}>Desmarcar tudo</Button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {navSections.map((section) => {
          const usable = section.items.filter((i) => allowedByRole(i.roles)).map((i) => i.href);
          const on = usable.filter((h) => !blocked.includes(h)).length;
          const state = usable.length === 0 || on === 0 ? false : on === usable.length ? true : "indeterminate";
          const Icon = section.items[0]?.icon;
          return (
            <div key={section.title} className="rounded-lg border border-border p-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <Checkbox checked={state} disabled={disabled || usable.length === 0}
                  onCheckedChange={() => onChange(toggleHrefs(blocked, usable, state !== true))} />
                {Icon && <Icon className="h-4 w-4 text-primary" />}
                {section.title}
              </label>
              <div className="ml-3 mt-1.5 space-y-1 border-l border-border pl-3">
                {section.items.map((item) => {
                  const roleOk = allowedByRole(item.roles);
                  const row = (
                    <label key={item.href} className={`flex items-center gap-2 text-xs ${roleOk ? "cursor-pointer" : "opacity-50"}`}>
                      <Checkbox checked={roleOk && !blocked.includes(item.href)} disabled={disabled || !roleOk}
                        onCheckedChange={(c) => onChange(toggleHrefs(blocked, [item.href], c === true))} />
                      {item.title}
                    </label>
                  );
                  return roleOk ? row : (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild><div>{row}</div></TooltipTrigger>
                      <TooltipContent>O papel deste usuário não permite esta tela</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
