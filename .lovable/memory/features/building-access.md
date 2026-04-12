---
name: Building access types
description: Buildings have 3 access categories — pedestrian, car park, motorcycle — each supports MULTIPLE items with type/provider/chargeable. Chargeable Homejoy items add to tenant move-in bill.
type: feature
---

## Building Access Structure

Each building stores 3 arrays of access items in `access_items` JSONB (key: pedestrian, carpark, motorcycle).

Each category supports **multiple** access items (e.g., a condo may need both Face ID for guard house and Access Card for lift).

### Each Access Item has:
- Access Type (varies by category)
- Access Location (multi-select, pedestrian only): Main Entrance, Lift, Guard House, Lobby
- Provided By: Management Office, Homejoy
- Chargeable Type: Not Chargeable, Deposit, One-time Fee, Processing Fee
- Price (RM) — shown only when chargeable
- Instruction Notes
- When Access Type = "None", all other fields are hidden

### Pedestrian Access Types
Access Card, Face ID, None

### Car Park Access Types
RFID, Sticker, ANPR, Access Card, None

### Motorcycle Access Types
RFID, Sticker, ANPR, Access Card, None

## Important Business Rule
If an access item is chargeable and provided by Homejoy, the price must be added to the tenant's move-in cost/bill when booking.
