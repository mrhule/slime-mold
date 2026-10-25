import type { GameRenderer } from '../render/renderer';
import { FxLayer } from '../render/fx-layer';
import { canPlace, pendingAllocation } from '../sim';
import { CELL } from '../render/units';
import type { BuildingType, Command, World } from '../sim/types';
import { BUILD_HOTKEYS } from './buildbar';

const PLAYER = 1;
const KEY_PAN_SPEED = 700; // screen px per second
const EDGE_PAN_SPEED = 520;
const EDGE_PX = 8;
const MARKER_HIT_PX = 16;

export interface InputActions {
  /** false on the title and round-end screens, where the map ignores input */
  canAct(): boolean;
  togglePause(): void;
  setSpeed(speed: 1 | 2 | 3): void;
  /** Esc outside placement mode: open or close the pause menu */
  escape(): void;
}

/**
 * Mouse and keyboard to player commands (controls.md). Every sim-changing input becomes a
 * Command stamped with the player's mold id; camera input stays local.
 */
export class InputController {
  private readonly keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  /** the building the player is about to place, or null outside placement mode */
  placing: BuildingType | null = null;
  /** cell under the cursor (placement preview), or null */
  hoverCell: number | null = null;
  private dragging = false;
  private lastDrag = { x: 0, y: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: GameRenderer,
    private readonly getWorld: () => Readonly<World>,
    private readonly send: (cmd: Command) => void,
    private readonly actions: InputActions,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => {
      this.pointer = null;
      this.hoverCell = null;
      this.dragging = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private screenPos(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private cellAt(sx: number, sy: number): number | null {
    const sim = this.getWorld();
    const [wx, wy] = this.renderer.camera.screenToWorld(sx, sy);
    const x = Math.floor(wx / CELL);
    const y = Math.floor(wy / CELL);
    if (x < 0 || y < 0 || x >= sim.width || y >= sim.height) return null;
    return y * sim.width + x;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.actions.canAct()) return;
    const [sx, sy] = this.screenPos(e);
    if (e.button === 1) {
      this.dragging = true;
      this.lastDrag = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      const cell = this.cellAt(sx, sy);
      if (cell === null) return;
      if (this.placing) {
        // always send, so a refusal comes back from the sim as a toast; stay in the mode if it will be refused
        const allowed = canPlace(this.getWorld(), PLAYER, this.placing, cell).ok;
        this.send({ type: 'placeBuilding', mold: PLAYER, building: this.placing, cell });
        if (allowed && !e.shiftKey) this.placing = null;
      } else {
        this.send({ type: 'setTarget', mold: PLAYER, cell });
      }
      return;
    }
    if (e.button === 2) {
      if (this.placing) {
        this.placing = null;
        return;
      }
      if (e.shiftKey) {
        this.send({ type: 'clearTargets', mold: PLAYER });
        return;
      }
      const sim = this.getWorld();
      const mold = sim.molds[PLAYER - 1];
      if (!mold) return;
      let best: { id: number; d: number } | null = null;
      for (const t of mold.targets) {
        const [mx, my] = FxLayer.markerPosition(t.cell, sim.width);
        const [px, py] = this.renderer.camera.worldToScreen(mx, my);
        const d = Math.hypot(px - sx, py - sy);
        if (d <= MARKER_HIT_PX && (!best || d < best.d)) best = { id: t.id, d };
      }
      if (best) this.send({ type: 'cancelTarget', mold: PLAYER, targetId: best.id });
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const [sx, sy] = this.screenPos(e);
    this.pointer = { x: sx, y: sy };
    this.hoverCell = this.placing ? this.cellAt(sx, sy) : null;
    if (this.dragging) {
      this.renderer.camera.pan(-(e.clientX - this.lastDrag.x), -(e.clientY - this.lastDrag.y));
      this.lastDrag = { x: e.clientX, y: e.clientY };
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button === 1) this.dragging = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const [sx, sy] = this.screenPos(e);
    this.renderer.camera.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015));
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT' && e.key !== 'Escape') return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (this.placing) this.placing = null;
      else this.actions.escape();
      return;
    }
    if (!this.actions.canAct()) return;
    const building = BUILD_HOTKEYS[k];
    if (building) {
      this.togglePlacing(building);
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      this.actions.togglePause();
      return;
    }
    if (k === '1' || k === '2' || k === '3') {
      this.actions.setSpeed(Number(k) as 1 | 2 | 3);
      return;
    }
    if (k === 'q' || k === 'e') {
      const value = Math.min(1, Math.max(0, pendingAllocation(this.getWorld(), PLAYER) + (k === 'e' ? 0.1 : -0.1)));
      this.send({ type: 'setAllocation', mold: PLAYER, value });
      return;
    }
    this.keys.add(k);
    if (k === 'h') {
      const [x, y] = this.renderer.coreWorldPosition(this.getWorld());
      this.renderer.camera.centerOn(x, y);
    }
    if (k.startsWith('arrow')) e.preventDefault();
  };

  /** enter placement mode for a building, or leave it if it is already selected */
  togglePlacing(type: BuildingType): void {
    this.placing = this.placing === type ? null : type;
    if (!this.placing) this.hoverCell = null;
    else if (this.pointer) this.hoverCell = this.cellAt(this.pointer.x, this.pointer.y);
  }

  /** cursor position in screen pixels, or null when it is off the canvas */
  get pointerPosition(): { x: number; y: number } | null {
    return this.pointer;
  }

  /** keyboard and screen-edge panning; call once per frame */
  update(dtSeconds: number): void {
    const cam = this.renderer.camera;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (dx !== 0 || dy !== 0) cam.pan(dx * KEY_PAN_SPEED * dtSeconds, dy * KEY_PAN_SPEED * dtSeconds);
    if (this.pointer && !this.dragging) {
      const { x, y } = this.pointer;
      let ex = 0;
      let ey = 0;
      if (x < EDGE_PX) ex = -1;
      else if (x > cam.viewW - EDGE_PX) ex = 1;
      if (y < EDGE_PX) ey = -1;
      else if (y > cam.viewH - EDGE_PX) ey = 1;
      if (ex !== 0 || ey !== 0) cam.pan(ex * EDGE_PAN_SPEED * dtSeconds, ey * EDGE_PAN_SPEED * dtSeconds);
    }
  }
}
