

## Plan: Add inline form validation to Tenant forms

### Problem
The Tenant Add and Edit forms (`TenantsContent.tsx`) currently use `toast.error` for validation (lines 328-329) and have no inline error styling. They need the same `useFormValidation` pattern used in other forms.

### Changes

**File: `src/components/TenantsContent.tsx`**

1. **Import** `useFormValidation`, `fieldClass`, `FieldError`, `FormErrorBanner` from `@/hooks/useFormValidation`.

2. **Add validation to `saveNewTenant`** (line 327): Replace the two `toast.error` checks with `validate()` call using rules for `name` and `phone` as required fields.

3. **Add validation to `saveTenant`** (line 288): Add the same validation for edit — name and phone are required.

4. **Pass validation state to `TenantForm`**: Add `errors` and `clearError` props to the shared `TenantForm` component.

5. **Update `TenantForm` component** (line 544):
   - Accept `errors` and `clearError` props
   - Add `FormErrorBanner` at the top of the form
   - Wrap Name and Contact No fields with `data-field` attributes
   - Apply `fieldClass` to those inputs for red border on error
   - Add `<FieldError>` below each required field
   - Call `clearError` on change for validated fields

### Required fields
- `name` — "Full Name is required"
- `phone` — "Contact number is required"

### No other files affected

