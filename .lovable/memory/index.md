# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: admin, agent.
No browser alerts/popups for validation — inline errors only.

## Memories
- [Room structure](mem://features/rooms) — Unit→5 rooms model, availability tracking
- [Form dialogs](mem://design/form-dialogs) — All add/edit forms use Dialog modals with cancel confirmation
- [Form validation](mem://design/form-validation) — Inline validation pattern, no browser popups, scroll-to-error
