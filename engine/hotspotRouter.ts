import type { HotspotDefinition, Point, SceneNode } from './types';

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function routeHotspotAt(node: SceneNode, point: Point): HotspotDefinition | undefined {
  return node.hotspots.find((hotspot) => pointInPolygon(point, hotspot.polygon));
}

export function clientPointToPercent(element: HTMLElement, clientX: number, clientY: number): Point {
  const rect = element.getBoundingClientRect();
  return [((clientX - rect.left) / rect.width) * 100, ((clientY - rect.top) / rect.height) * 100];
}
