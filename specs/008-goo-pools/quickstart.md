# Quickstart: Pools of Primordial Goo

## Automated checks

```bash
npm run typecheck
npm test
npm run build
npx tsx tests/bench/tick.bench.ts
npm run sim:batch -- --rounds 1-4 --games 20
```

Expect every test to pass, the bench under its budget, and stand-in win rates for rounds 1 to 4 within 10
points of the numbers before this feature.

## Play it

```bash
npm run dev
```

1. Start a round; green goo wells are on the map from the start, even in the fog. There is no farm in the
   build menu.
2. Grow a vein to the nearest pool: the mold spreads over the pool. Without a store house the HUD says a pool
   is waiting; build a Store House on the same vein and income rises.
3. Wait: the pool never runs dry.
4. Reach a contested pool with a rival: income follows the cells each of you holds.
5. On a phone, the same, with the pool hint shown on tap.
