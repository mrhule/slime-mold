# Playtest checklist: 003 Store House, Fertile Ground, Farm Output

Run with `npm run dev` (add `?seed=7&nopause` to keep a fixed map). Tick each item when seen.

## US1: Store house and caps

- [ ] The nutrient readout shows `stock / cap` and is understood without explanation.
- [ ] **FULL** appears in red when a piece is at its cap, and income stops growing the stock.
- [ ] `T` (or the Store button) enters placement mode; the cursor tip shows the cap change
      ("stock cap 300 to 600").
- [ ] The store house is easy to tell from the farm, booster, and harvester at a glance, also in
      grayscale.
- [ ] Losing a store house (let a rival eat it, or cut its cell) cuts the stock above the new cap
      and shows "Stock lost!".

## US2: Fertile ground and linked farms

- [ ] Fertile ground (green wash with inked tufts) is visible in the fog and reads in grayscale,
      and is not mistaken for rough ground (diagonal hatching).
- [ ] Every start has several patches nearby, and a few sit in the middle of the map.
- [ ] A farm only goes on fertile ground; elsewhere the cursor tip says "Farms need fertile ground!".
- [ ] A farm with no store house on its vein shows the broken-chain mark, the HUD shows the amber
      "not paying" line, and the Store button bounces.
- [ ] Placing the store house on that vein makes the farm pay at once; income in the HUD rises.
- [ ] With the stock at its cap the farms slow down instead of wasting output.
- [ ] A new player can afford their first linked farm within about two minutes on round 1.
