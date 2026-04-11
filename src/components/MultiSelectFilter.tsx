import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectFilterProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onApply: (selected: string[]) => void;
  className?: string;
}

export function MultiSelectFilter({
  label,
  placeholder,
  options,
  selected,
  onApply,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selected);

  // Sync draft when popover opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setDraft(selected);
    setOpen(isOpen);
    if (!isOpen) setSearch("");
  };

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const toggle = (val: string) => {
    setDraft((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const apply = () => {
    onApply(draft);
    setOpen(false);
    setSearch("");
  };

  const clear = () => {
    setDraft([]);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between h-10 font-normal"
          >
            <span className="truncate text-sm">
              {selected.length === 0
                ? placeholder
                : `${selected.length} selected`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Options */}
          <ScrollArea className="max-h-[280px]">
            <div className="p-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No results
              </p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={draft.includes(opt)}
                    onCheckedChange={() => toggle(opt)}
                  />
                  <span className="capitalize truncate">{opt}</span>
                </label>
              ))
            )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-border p-2 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={draft.length === 0}
              className="text-muted-foreground"
            >
              Clear
            </Button>
            <Badge variant="secondary" className="text-xs">
              {draft.length} selected
            </Badge>
            <Button size="sm" onClick={apply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
