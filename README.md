# Slime Mold

A single-player browser RTS: you are a slime mold. Grow a vein network toward food, allocate
nutrients between growth and fighting, and take over the map from rival molds. Each round is a
generated map and gets harder.

Built with TypeScript, PixiJS and Vite, organized with [Spec Kit](https://github.com/github/spec-kit).
Specs live in `specs/`; project principles in `.specify/memory/constitution.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # headless simulation tests
npm run typecheck
npm run build
```

See `specs/001-core-game-loop/quickstart.md` for validation steps.
