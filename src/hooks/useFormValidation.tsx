import { useState, useCallback } from "react";

export type ValidationRules = Record<string, (value: any) => string | null>;

export function useFormValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((form: Record<string, any>, rules: ValidationRules): boolean => {
    const newErrors: Record<string, string> = {};
    for (const [field, rule] of Object.entries(rules)) {
      const msg = rule(form[field]);
      if (msg) newErrors[field] = msg;
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Scroll to first error field
      const firstKey = Object.keys(newErrors)[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstKey}"]`) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = el.querySelector("input, select, textarea") as HTMLElement | null;
          if (input) input.focus();
        }
      }, 50);
      return false;
    }
    return true;
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAllErrors, setErrors };
}

/** Returns input class with optional error border */
export function fieldClass(base: string, hasError: boolean): string {
  return hasError ? `${base} border-destructive ring-destructive` : base;
}

/** Inline error message component */
export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm text-destructive mt-1">{error}</p>;
}

/** Form-level error banner */
export function FormErrorBanner({ errors }: { errors: Record<string, string> }) {
  if (Object.keys(errors).length === 0) return null;
  return (
    <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 text-sm font-medium">
      Please complete all required fields before saving.
    </div>
  );
}
