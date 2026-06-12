import type { Point } from './types';

export interface PolygonBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  areaPercent: number;
}

export function polygonBounds(polygon: readonly Point[]): PolygonBounds {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  return { minX, minY, maxX, maxY, width, height, areaPercent: width * height };
}

export function polygonAreaPercent(polygon: readonly Point[]): number {
  let area = 0;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[previous];
    const [x2, y2] = polygon[index];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function boundsOverlapAreaPercent(a: PolygonBounds, b: PolygonBounds): number {
  const width = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const height = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return width * height;
}

export function clipPathWithinBounds(polygon: readonly Point[], bounds = polygonBounds(polygon)): string {
  const points = polygon.map(([x, y]) => {
    const localX = bounds.width === 0 ? 0 : ((x - bounds.minX) / bounds.width) * 100;
    const localY = bounds.height === 0 ? 0 : ((y - bounds.minY) / bounds.height) * 100;
    return `${localX.toFixed(2)}% ${localY.toFixed(2)}%`;
  });
  return `polygon(${points.join(', ')})`;
}

// Same local-coordinate mapping as clipPathWithinBounds, but as SVG polygon
// points in a 0-100 viewBox — used to draw the clue silhouette outline.
export function svgPointsWithinBounds(polygon: readonly Point[], bounds = polygonBounds(polygon)): string {
  return polygon
    .map(([x, y]) => {
      const localX = bounds.width === 0 ? 0 : ((x - bounds.minX) / bounds.width) * 100;
      const localY = bounds.height === 0 ? 0 : ((y - bounds.minY) / bounds.height) * 100;
      return `${localX.toFixed(2)},${localY.toFixed(2)}`;
    })
    .join(' ');
}
