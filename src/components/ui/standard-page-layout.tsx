import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface StandardPageLayoutProps {
  title: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  actionVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  secondaryActions?: ReactNode;
  children: ReactNode;
  count?: number;
}

export function StandardPageLayout({
  title,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  actionVariant = "default",
  secondaryActions,
  children,
  count,
}: StandardPageLayoutProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-extrabold">{title}</h2>
          {count !== undefined && (
            <span className="text-sm text-muted-foreground">({count})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {secondaryActions}
          {actionLabel && onAction && (
            <Button onClick={onAction} variant={actionVariant}>
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
