import { Application, Container } from 'pixi.js';
import type { World } from '../sim/types';
import { BuildingLayer } from './building-layer';
import { Camera } from './camera';
import { FilmLayer } from './film-layer';
import { FogLayer } from './fog-layer';
import { FoodLayer } from './food-layer';
import { FxLayer } from './fx-layer';
import type { PlacementGhost } from './fx-layer';
import { bakeTerrain } from './terrain-layer';
import type { QualityLevel } from './style';
import { VeinLayer } from './vein-layer';
import { CELL } from './units';

/**
 * Owns the PixiJS stage and the ordered layers (terrain, film, food, veins, fx). It only ever
 * reads the world (Constitution I): nothing here writes sim state.
 */
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

  constructor(readonly app: Application, sim: Readonly<World>) {
    this.camera = new Camera(sim.width * CELL, sim.height * CELL);
    this.app.stage.addChild(this.world);
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
    this.world.addChild(bakeTerrain(sim), this.film.container, this.food.container, this.veins.container, this.buildings.container, this.fog.container, this.fx.container);
    const core = sim.molds[0]?.core ?? 0;
    this.camera.zoom = 1.2;
    this.camera.centerOn((core % sim.width) * CELL, Math.floor(core / sim.width) * CELL);
  }

  /** switch the quality level; layers pick it up on their next draw */
  setQuality(level: QualityLevel): void {
    this.quality = level;
  }

  resize(): void {
    this.camera.setView(this.app.screen.width, this.app.screen.height);
  }

  /** world position of the player's core, for the "H" shortcut */
  coreWorldPosition(sim: Readonly<World>): [number, number] {
    const core = sim.molds[0]?.core ?? 0;
    return [(core % sim.width) * CELL + CELL / 2, Math.floor(core / sim.width) * CELL + CELL / 2];
  }

  update(sim: Readonly<World>, dtSeconds: number, ghost: PlacementGhost | null = null): void {
    this.timeSeconds += dtSeconds;
    this.camera.apply(this.world);
    this.film.update(sim, this.timeSeconds);
    this.food.update(sim);
    this.veins.update(sim, this.timeSeconds, this.quality);
    this.buildings.update(sim);
    this.fog.update(sim, this.timeSeconds);
    this.fx.update(sim, sim.molds[0], dtSeconds, this.timeSeconds, ghost);
  }
}
