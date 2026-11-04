# link/ — Slime Link (copied from the hero repo)

This folder is a **copy** of `link/` in the sibling game *Slime Mold: Hero* (`slime-mold-shot`). It is the LAN
relay, the wire protocol and the client both games use to talk. It is not published as a package, so the two
copies **must be kept in step by hand**: when `protocol.ts` (or any file here) changes in one repo, copy it to
the other in the same change. The commander side of the protocol is handled in `src/coop/`.

`hero-upgrades.ts` is also a copy: the upgrade list and prices from the hero repo's `src/upgrades.ts`
(`UPGRADES`, `upgradeCost`), without the hero stat maths.

The relay is attached to the Vite dev and preview servers at `/link` (see `vite.config.ts`). `npm run lan`
serves the game to other devices on the network.
