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
