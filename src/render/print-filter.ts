import { Filter } from 'pixi.js';
import fragment from './shaders/print.frag?raw';

const vertex = `precision highp float;
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

interface PrintUniforms {
  uPitch: number;
  uFringe: number;
}

/**
 * The optional print texture (A9): a filter over the finished world picture with a halftone dot
 * screen, grain and a small red/blue offset. It only reads pixels, so it cannot change what the
 * player can tell about the sim; the renderer attaches it only when the setting is on and the
 * quality level is High.
 */
export class PrintFilter {
  readonly filter: Filter;
  private readonly uniforms: PrintUniforms;

  private constructor(filter: Filter) {
    this.filter = filter;
    this.uniforms = filter.resources.printUniforms.uniforms as PrintUniforms;
  }

  /** null when the filter cannot be built (the setting is then hidden) */
  static create(): PrintFilter | null {
    try {
      const filter = Filter.from({
        gl: { vertex, fragment },
        resources: { printUniforms: { uPitch: { value: 5, type: 'f32' }, uFringe: { value: 1, type: 'f32' } } },
      });
      return new PrintFilter(filter);
    } catch {
      return null;
    }
  }

  /** dots grow a little as the camera zooms in, so close-ups do not turn to mush */
  setZoom(zoom: number): void {
    this.uniforms.uPitch = 4 + Math.min(2, Math.max(0.5, zoom)) * 1.5;
  }

  setEnabled(on: boolean): void {
    this.filter.enabled = on;
  }
}
