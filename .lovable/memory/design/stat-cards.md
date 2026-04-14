---
name: Stat card standards
description: Standardized stat card component — use StatCard from ui/stat-card.tsx for all summary/metric cards
type: design
---
Always use `<StatCard>` from `@/components/ui/stat-card` for any metric/summary card.

Standard specs:
- Value font: text-2xl font-bold
- Padding: p-4
- Background: bg-card border rounded-lg
- Label: text-xs font-medium text-foreground
- Subtitle (optional): text-[11px] text-muted-foreground
- Icon (optional): 8x8 rounded-lg container, 4x4 icon
- Clickable cards get hover:shadow-md hover:border-primary/30

Props: label, subtitle?, value, icon?, iconColor?, iconBg?, valueColor?, onClick?, className?
