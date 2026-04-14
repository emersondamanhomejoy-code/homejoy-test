import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  subtitle?: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  valueColor?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Standardized stat card used across dashboards, detail views, and summary sections.
 * - Font: text-2xl font-bold for value
 * - Padding: p-4
 * - Background: bg-card border rounded-lg
 * - Label: text-xs font-medium
 */
export function StatCard({
  label,
  subtitle,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  valueColor = "text-foreground",
  onClick,
  className,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "bg-card rounded-lg border p-4 text-left",
        onClick && "hover:shadow-md hover:border-primary/30 transition-all cursor-pointer",
        className
      )}
    >
      {Icon && (
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      )}
      <div className={cn("text-2xl font-bold", valueColor)}>{value}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
      {subtitle && (
        <div className="text-[11px] text-muted-foreground leading-tight">{subtitle}</div>
      )}
    </Wrapper>
  );
}
