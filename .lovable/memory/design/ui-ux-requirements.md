---
name: Global UI/UX Requirements
description: Layout, page structure, modals, tables, mobile, action labels, dangerous actions — mandatory across all pages
type: design
---

## 1.1 Layout
- Fixed left sidebar, right content area, top page header inside content area
- Clean tables, responsive for desktop/tablet/mobile

## 1.2 Standardized Page Structure
Every main data page:
- Page title
- Short description if helpful
- Top-right primary action button
- Search field
- Filters area
- Table list
- Row actions on right side

## 1.3 Standardized Action Labels
Use exactly: Add, View, Edit, Delete, Approve, Reject, Cancel, Submit, Reverse
Do NOT mix Add/Create/New, Remove/Delete, Confirm/Submit/Save unless meaning is truly different.

## 1.4 Modals
- All create/edit/view use responsive floating modal (Dialog), NOT side drawers
- Cannot close by clicking outside
- Sticky bottom action bar: left=Cancel, right=primary action
- If unsaved data, show discard confirmation

## 1.5 Table Behavior
- Search, simple visible filters, optional advanced filter panel
- Consistent row action placement
- Status badges with consistent color meanings

## 1.6 Mobile
- Sidebar collapses
- Modals may become full-screen style
- Keep sticky bottom action buttons
- Do NOT switch to drawer UX

## 1.7 Dangerous Actions (always confirmation + optional reason)
Delete, Cancel, Reverse, Move Out, Mark Paid, Remove occupancy binding
