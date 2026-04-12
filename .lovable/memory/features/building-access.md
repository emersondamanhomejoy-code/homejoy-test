---
name: Building access types
description: Buildings have 3 access categories — pedestrian, car park, motorcycle — each with type/provider/chargeable. Chargeable items add to tenant move-in bill.
type: feature
---

## Building Access Structure

Each building has 3 separate access configurations stored in `access_items` JSONB:

### Pedestrian Access
- Access Type: Access Card, Face ID, None
- Access Location (multi-select): Main Entrance, Lift, Guard House, Lobby
- Provided By: Management Office, Homejoy
- Chargeable: Yes/No
- Price (RM)
- Instruction Notes

### Car Park Access
- Access Type: RFID, Sticker, ANPR, Access Card, None
- No access location needed
- Provided By: Management Office, Homejoy
- Chargeable: Yes/No
- Price (RM)
- Instruction Notes

### Motorcycle Access
- Access Type: (same as car park) RFID, Sticker, ANPR, Access Card, None
- Provided By: Management Office, Homejoy
- Chargeable: Yes/No
- Price (RM)
- Instruction Notes

## Important Business Rule
If an access item is chargeable and provided by Homejoy, the price must be added to the tenant's move-in cost/bill when booking.
