import type { Container } from 'pixi.js';
import { style } from './style';

/** Pan and zoom over the world, clamped to the map (controls.md). Coordinates are world units. */
export class Camera {
  /** world point at the center of the screen */
  x = 0;
  y = 0;
  zoom = 1;
  readonly minZoom = 0.5;
  readonly maxZoom = 3;
  viewW = 800;
  viewH = 600;
  /** current shake amplitude in screen pixels; decays on its own (A13) */
  shakeAmount = 0;
  /** turns shake off completely (the Reduce motion setting) */
  reduceMotion = false;
  private shakeSeed = 0x2545f491;
  private shakeX = 0;
  private shakeY = 0;

  constructor(
    public worldW: number,
    public worldH: number,
  ) {}

  setView(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  setWorld(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.clamp();
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [this.x + (sx - this.viewW / 2) / this.zoom, this.y + (sy - this.viewH / 2) / this.zoom];
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.viewW / 2, (wy - this.y) * this.zoom + this.viewH / 2];
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.clamp();
  }

  /** pan by a screen-space offset */
  pan(dxScreen: number, dyScreen: number): void {
    this.x += dxScreen / this.zoom;
    this.y += dyScreen / this.zoom;
    this.clamp();
  }

  /** zoom by `factor`, keeping the world point under (sx, sy) fixed */
  zoomAt(sx: number, sy: number, factor: number): void {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    this.x = wx - (sx - this.viewW / 2) / this.zoom;
    this.y = wy - (sy - this.viewH / 2) / this.zoom;
    this.clamp();
  }

  clamp(): void {
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom;
    this.x = this.worldW <= halfW * 2 ? this.worldW / 2 : Math.min(this.worldW - halfW, Math.max(halfW, this.x));
    this.y = this.worldH <= halfH * 2 ? this.worldH / 2 : Math.min(this.worldH - halfH, Math.max(halfH, this.y));
  }

  /** add to the shake amplitude (capped); does nothing with reduced motion */
  addShake(amount: number): void {
    if (this.reduceMotion || !(amount > 0)) return;
    this.shakeAmount = Math.min(style.shake.max, this.shakeAmount + amount);
  }

  /** decay the shake and pick this frame's offset from a small local generator (never the sim's) */
  tickShake(dtSeconds: number): void {
    if (this.reduceMotion) this.shakeAmount = 0;
    this.shakeAmount *= Math.exp(-dtSeconds / style.shake.decaySeconds);
    if (this.shakeAmount < 0.02) this.shakeAmount = 0;
    if (this.shakeAmount === 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    this.shakeX = (this.nextShake() * 2 - 1) * this.shakeAmount;
    this.shakeY = (this.nextShake() * 2 - 1) * this.shakeAmount;
  }

  private nextShake(): number {
    let t = (this.shakeSeed = (this.shakeSeed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** the shake moves only the drawn world, never x, y, centerOn or the clamp */
  apply(world: Container): void {
    world.scale.set(this.zoom);
    world.position.set(this.viewW / 2 - this.x * this.zoom + this.shakeX, this.viewH / 2 - this.y * this.zoom + this.shakeY);
  }
}
