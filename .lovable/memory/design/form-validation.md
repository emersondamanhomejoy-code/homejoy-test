---
name: Form Validation Pattern
description: All forms use inline validation — no browser alerts/popups, red borders, scroll-to-first-error
type: design
---
All forms must use in-page inline validation, never browser-native popups or alert().
- useFormValidation hook from src/hooks/useFormValidation.tsx
- Red border on invalid fields (fieldClass helper)
- Red error text below field (FieldError component)
- FormErrorBanner at top of form: "Please complete all required fields before saving."
- On submit: validate all fields, scroll to first error, focus it
- Clear individual errors on field change (clearError)
- toast.error for non-field errors (upload failures, server errors)
