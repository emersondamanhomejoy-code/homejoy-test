import { Eye, Pencil, Trash2, Check, X, RotateCcw, Snowflake, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type ActionType =
  | "view"
  | "edit"
  | "delete"
  | "approve"
  | "reject"
  | "cancel"
  | "reverse"
  | "freeze"
  | "unfreeze";

interface ActionConfig {
  icon: LucideIcon;
  title: string;
  destructive?: boolean;
}

const actionConfigs: Record<ActionType, ActionConfig> = {
  view: { icon: Eye, title: "View" },
  edit: { icon: Pencil, title: "Edit" },
  delete: { icon: Trash2, title: "Delete", destructive: true },
  approve: { icon: Check, title: "Approve" },
  reject: { icon: X, title: "Reject", destructive: true },
  cancel: { icon: X, title: "Cancel", destructive: true },
  reverse: { icon: RotateCcw, title: "Reverse", destructive: true },
  freeze: { icon: Snowflake, title: "Freeze" },
  unfreeze: { icon: Sun, title: "Unfreeze" },
};

interface ActionButtonProps {
  type: ActionType;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function ActionButton({ type, onClick, disabled, className }: ActionButtonProps) {
  const config = actionConfigs[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={config.title}
      className={cn(
        "p-1.5 rounded-md transition-colors text-muted-foreground",
        config.destructive
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-secondary hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

interface ActionButtonsProps {
  actions: {
    type: ActionType;
    onClick: () => void;
    show?: boolean;
    disabled?: boolean;
  }[];
}

export function ActionButtons({ actions }: ActionButtonsProps) {
  const visible = actions.filter((a) => a.show !== false);
  if (visible.length === 0) return null;

  return (
    <div className="flex gap-1 justify-end">
      {visible.map((action, i) => (
        <ActionButton
          key={`${action.type}-${i}`}
          type={action.type}
          onClick={action.onClick}
          disabled={action.disabled}
        />
      ))}
    </div>
  );
}
