// Shared UI styling constants used across all pages
export const inputClass =
  "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export const labelClass =
  "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

export const cardClass = "bg-card rounded-xl shadow-sm border border-border";

export const activeFilterClass = "border-primary ring-1 ring-primary/40";

export const filterFieldClass = (active: boolean) =>
  `${inputClass} ${active ? activeFilterClass : ""}`.trim();

// Maps old/new unit_type DB values to display labels
const unitTypeMap: Record<string, string> = {
  "Mix Unit": "Mixed Gender",
  "Female Unit": "Female Only",
  "Male Unit": "Male Only",
  "Mixed Gender": "Mixed Gender",
  "Female Only": "Female Only",
  "Male Only": "Male Only",
};

export const formatUnitType = (val: string): string => unitTypeMap[val] || val;
