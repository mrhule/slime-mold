import { Application, Container } from 'pixi.js';
import type { World } from '../sim/types';
import { BuildingLayer } from './building-layer';
import { Sprite } from 'pixi.js';
import { art } from './art';
import { Camera } from './camera';
import { FilmLayer } from './film-layer';
import { FogLayer } from './fog-layer';
import { FoodLayer } from './food-layer';
import { PrintFilter } from './print-filter';
import { FxLayer } from './fx-layer';
import type { PlacementGhost } from './fx-layer';
import { bakeTerrain } from './terrain-layer';
import { style } from './style';
import type { QualityLevel } from './style';
import { VeinLayer } from './vein-layer';
import { CELL } from './units';

/**
 * Owns the PixiJS stage and the ordered layers (terrain, film, food, veins, fx). It only ever
 * reads the world (Constitution I): nothing here writes sim state.
 */
/** how much bigger than the screen the vignette image is drawn */
const VIGNETTE_OVERSCAN = 1.35;

export class GameRenderer {
  readonly camera: Camera;
  readonly world = new Container();
  film!: FilmLayer;
  veins!: VeinLayer;
  food!: FoodLayer;
  buildings!: BuildingLayer;
  fog!: FogLayer;
  fx!: FxLayer;
  private timeSeconds = 0;
  /** the quality level layers read to decide which passes to draw (A14) */
  quality: QualityLevel = 'high';
  /** the optional print texture (A9); null when the filter could not be built */
  readonly print = PrintFilter.create();
  private printOn = false;
  private vignette: Sprite | null = null;

  constructor(readonly app: Application, sim: Readonly<World>) {
    this.camera = new Camera(sim.width * CELL, sim.height * CELL);
    this.app.stage.addChild(this.world);
    const painted = art();
    if (painted) {
      // dark, hand-inked corners over the map, under the interface
      this.vignette = new Sprite(painted.vignette);
      this.vignette.alpha = 0.7;
      this.vignette.eventMode = 'none';
      this.app.stage.addChild(this.vignette);
    }
    this.build(sim);
    this.resize();
  }

  /** (Re)build all layers for a new round. */
  build(sim: Readonly<World>): void {
    for (const child of this.world.removeChildren()) child.destroy({ children: true });
    this.camera.setWorld(sim.width * CELL, sim.height * CELL);
    this.film = new FilmLayer(sim);
    this.veins = new VeinLayer(sim);
    this.food = new FoodLayer();
    this.buildings = new BuildingLayer();
    this.fog = new FogLayer(sim);
    this.fx = new FxLayer();
    this.fx.setSplatScale(style.quality[this.quality].splatScale);
    this.world.addChild(bakeTerrain(sim), this.film.container, this.food.container, this.veins.container, this.fx.flowContainer, this.buildings.container, this.fog.container, this.food.poolContainer, this.fx.container);
    const core = sim.molds[0]?.core ?? 0;
    this.camera.zoom = 1.2;
    this.camera.centerOn((core % sim.width) * CELL, Math.floor(core / sim.width) * CELL);
  }

  /** switch the quality level; layers pick it up on their next draw */
  setQuality(level: QualityLevel): void {
    this.quality = level;
    this.fx?.setSplatScale(style.quality[level].splatScale);
    this.syncPrint();
  }

  /** the print texture setting; it also needs High quality, and off leaves the plain look untouched */
  setPrintTexture(on: boolean): void {
    this.printOn = on;
    this.syncPrint();
  }

  private syncPrint(): void {
    const active = this.print !== null && this.printOn && this.quality === 'high';
    this.world.filters = active && this.print ? [this.print.filter] : null;
  }

  resize(): void {
    this.camera.setView(this.app.screen.width, this.app.screen.height);
    if (this.vignette && (Math.abs(this.vignette.width - this.app.screen.width * VIGNETTE_OVERSCAN) > 0.5 || Math.abs(this.vignette.height - this.app.screen.height * VIGNETTE_OVERSCAN) > 0.5)) {
      // larger than the screen, so only the corners are dark and the middle stays clear
      this.vignette.width = this.app.screen.width * VIGNETTE_OVERSCAN;
      this.vignette.height = this.app.screen.height * VIGNETTE_OVERSCAN;
      this.vignette.position.set(-(this.vignette.width - this.app.screen.width) / 2, -(this.vignette.height - this.app.screen.height) / 2);
    }
  }

  /** world position of the player's core, for the "H" shortcut */
  coreWorldPosition(sim: Readonly<World>): [number, number] {
    const core = sim.molds[0]?.core ?? 0;
    return [(core % sim.width) * CELL + CELL / 2, Math.floor(core / sim.width) * CELL + CELL / 2];
  }

  update(sim: Readonly<World>, dtSeconds: number, ghost: PlacementGhost | null = null, inspect: number | null = null): void {
    this.timeSeconds += dtSeconds;
    this.camera.apply(this.world);
    this.print?.setZoom(this.camera.zoom);
    this.film.update(sim, this.timeSeconds);
    this.food.update(sim);
    this.veins.update(sim, this.timeSeconds, this.quality);
    this.buildings.update(sim, this.timeSeconds);
    this.fog.update(sim, this.timeSeconds);
    this.fx.update(sim, sim.molds[0], dtSeconds, this.timeSeconds, ghost, inspect);
  }
}
