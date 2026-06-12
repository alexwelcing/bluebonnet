export interface VhsCompositorControls {
  setIntensity(intensity: number): void;
  destroy(): void;
}

// The grain canvas renders at a fixed low resolution and is stretched by CSS;
// a full-resolution ImageData every tick costs megabytes per frame on phones
// for no visible gain at this blur/opacity.
const GRAIN_WIDTH = 160;
const GRAIN_HEIGHT = 90;

export function installVhsCompositor(root: HTMLElement, initialIntensity: number): VhsCompositorControls {
  const grain = document.createElement('canvas');
  grain.className = 'vhs-grain';
  grain.setAttribute('aria-hidden', 'true');
  grain.width = GRAIN_WIDTH;
  grain.height = GRAIN_HEIGHT;
  grain.style.imageRendering = 'pixelated';
  root.append(grain);

  const context = grain.getContext('2d');
  const image = context?.createImageData(GRAIN_WIDTH, GRAIN_HEIGHT);

  const renderGrain = () => {
    if (!context || !image) {
      return;
    }
    for (let index = 0; index < image.data.length; index += 4) {
      const shade = Math.random() * 255;
      image.data[index] = shade;
      image.data[index + 1] = shade;
      image.data[index + 2] = shade;
      image.data[index + 3] = 20;
    }
    context.putImageData(image, 0, 0);
  };

  renderGrain();
  const interval = window.setInterval(renderGrain, 120);

  const setIntensity = (intensity: number) => {
    const clamped = Math.max(0, Math.min(1, intensity));
    root.style.setProperty('--vhs-intensity', clamped.toFixed(2));
  };
  setIntensity(initialIntensity);

  return {
    setIntensity,
    destroy() {
      window.clearInterval(interval);
      grain.remove();
    },
  };
}
