# yugen-merchant
<p align="center">
  <a href="https://www.youtube.com/watch?v=y_xd5sPbzKs">
    <img src="https://img.youtube.com/vi/y_xd5sPbzKs/maxresdefault.jpg" width="100%" alt="Watch the demo">
  </a>
  <br>
  <a href="https://www.youtube.com/watch?v=y_xd5sPbzKs">Click here for video demonstration</a>
</p>

_A dynamic NPC merchant module for Foundry VTT V14, featuring a universal GUI and quality-based pricing._

---

## Features

- **Universal Merchant GUI**: Manage all merchant settings and inventory from a single, clean interface.
- **GM Initialization**: Right-click any NPC token and click the Store icon to open the GUI.
- **Manage Tab (GM/Owner)**:
    - **Toggle Merchant Mode**: Quickly turn any NPC into a shop.
    - **Infinite Funds**: Option for merchants to ignore their character sheet balance.
    - **Greeting Messages**: Set a custom flavor text whispered to players when they open the shop.
    - **Owner Management**: Allow players who own the token to manage the shop inventory.
    - **Rarity Multipliers**: Customize price scaling based on item rarity (Common, Rare, Legendary, etc.).
- **Player Shop Interface**:
    - **Buy & Sell Tabs**: Clean lists with item images, quantities, and calculated prices.
    - **Weight Warnings**: A pulsing icon alerts players if an item will make them encumbered.
    - **Smart Stacking**: Purchased items automatically merge into existing stacks in the player's inventory.
- **System Agnostic**: Works with most major systems (DnD5e, PF2e, etc.) for currency and weight.

## How to Use

1. **Right-click a Token** to open the HUD.
2. Click the **Store Icon** (appears as a Store-Slash for non-merchants).
3. Switch to the **Manage** tab.
4. Check **Enable Merchant Mode**.
5. **Drag and Drop** items from the sidebar or compendiums into the Manage tab to stock the shop.

## Settings

- **Allowed Item Types**: Filter which items can be sold to merchants (e.g., weapon, armor, consumable).
- **Disable When Dead**: Prevents players from trading with deceased or defeated NPCs.
- **Default Multipliers**: Set world-wide defaults for buy and sell rates.
