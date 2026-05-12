# yugen-merchant
<p align="center">
  <a href="https://www.youtube.com/watch?v=y_xd5sPbzKs">
    <img src="https://img.youtube.com/vi/y_xd5sPbzKs/maxresdefault.jpg" width="100%" alt="Watch the demo">
  </a>
  <br>
  <a href="https://www.youtube.com/watch?v=y_xd5sPbzKs">Click here for video demonstration</a>
</p>

_A dynamic NPC merchant module for Foundry VTT V14, featuring a universal GUI, macro-driven services, and quality-based pricing._

---

## Features

- **Universal Merchant GUI**: Manage all merchant settings, services, and inventory from a single, clean interface.
- **Macro-Driven Services**: Offer more than just items. Create custom services (Inn stays, healing, transport) linked to Foundry Macros that execute on the player's client upon purchase.
- **Interaction Proximity**: Set a per-merchant interaction range (default 10ft). Players receive clear notifications if they try to trade from too far away. Set to 0 for unlimited range.
- **Accessibility for Players**: Players can double-click any merchant token to open the shop immediately, bypassing the need for HUD access or observer permissions.
- **Manage Tab (GM/Owner)**:
    - **Toggle Merchant Mode**: Quickly turn any NPC into a shop.Any 
    - **Service Editor**: Create, edit, and delete services with custom names, icons, prices, and linked macros.
    - **Infinite Funds**: Option for merchants to ignore their character sheet balance.
    - **Greeting Messages**: Set a custom flavor text whispered to players when they open the shop.
    - **Owner Management**: Allow players who own the token to manage the shop inventory.
    - **Rarity Multipliers**: Customize price scaling based on item rarity (Common, Rare, Legendary, etc.).
- **Player Shop Interface**:
    - **Buy, Sell, & Services Tabs**: Highly legible lists with item images, descriptions, and calculated prices.
    - **Weight Warnings**: A pulsing icon alerts players if an item will make them encumbered.
    - **Smart Stacking**: Purchased items automatically merge into existing stacks in the player's inventory.
- **System Agnostic**: Works with most major systems (DnD5e, PF2e, etc.) for currency and weight.

## How to Use

1. **Right-click a Token** to open the HUD, or **Double-click** to open the shop instantly.
2. Click the **Store Icon** in the HUD (appears as a Store-Slash for non-merchants).
3. Switch to the **Manage** tab (GMs or allowed Owners).
4. Check **Enable Merchant Mode**.
5. **Drag and Drop** items from the sidebar or compendiums into the Manage tab to stock the shop.
6. Use the **Add Service** button to define custom macro-linked interactions.

## Settings

- **Allowed Item Types**: Filter which items can be sold to merchants (e.g., weapon, armor, consumable).
- **Disable When Dead**: Prevents players from trading with deceased or defeated NPCs.
- **Default Multipliers**: Set world-wide defaults for buy and sell rates.
- **Interaction Range**: Define the default distance for new merchants (can be overridden per-token).
