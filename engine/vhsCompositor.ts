export interface VhsCompositorControls {
  setIntensity(intensity: number): void;
  destroy(): void;
}

export function installVhsCompositor(root: HTMLElement, initialIntensity: number): VhsCompositorControls {
  const grain = document.createElement('canvas');
  grain.className = 'vhs-grain';
  grain.setAttribute('aria-hidden', 'true');
  root.append(grain);

  const context = grain.getContext('2d');
  const resize = () => {
    grain.width = Math.max(1, root.clientWidth);
    grain.height = Math.max(1, root.clientHeight);
  };

  const renderGrain = () => {
    if (!context) {
      return;
    }
    const image = context.createImageData(grain.width, grain.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const shade = Math.random() * 255;
      image.data[index] = shade;
      image.data[index + 1] = shade;
      image.data[index + 2] = shade;
      image.data[index + 3] = 20;
    }
    context.putImageData(image, 0, 0);
  };

  resize();
  renderGrain();
  const interval = window.setInterval(renderGrain, 120);
  window.addEventListener('resize', resize);

  const setIntensity = (intensity: number) => {
    const clamped = Math.max(0, Math.min(1, intensity));
    root.style.setProperty('--vhs-intensity', clamped.toFixed(2));
  };
  setIntensity(initialIntensity);

  return {
    setIntensity,
    destroy() {
      window.clearInterval(interval);
      window.removeEventListener('resize', resize);
      grain.remove();
    },
  };
}
