import { ReactNode, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-4xl",
};

interface StandardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  size?: "sm" | "md" | "lg" | "xl";
  isDirty?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the default Cancel button in footer */
  hideCancel?: boolean;
  className?: string;
}

export function StandardModal({
  open,
  onOpenChange,
  title,
  size = "md",
  isDirty = false,
  children,
  footer,
  hideCancel = false,
  className,
}: StandardModalProps) {
  const [showDiscard, setShowDiscard] = useState(false);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      onOpenChange(false);
    }
  }, [isDirty, onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent
          className={cn(
            sizeMap[size],
            "max-h-[90vh] p-0 flex flex-col",
            "max-md:max-w-[100vw] max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:rounded-none",
            className,
          )}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          hideClose
        >
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4">{children}</div>
          </ScrollArea>

          {/* Sticky footer */}
          <div className="border-t px-6 py-4 flex items-center justify-between gap-3 shrink-0 bg-background">
            <div>
              {!hideCancel && (
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">{footer}</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel? Your unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
