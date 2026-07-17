import type { Project } from '../models/Project';

export const DEFAULT_ACCENT_COLOR = '#007acc';

/**
 * Returns the project's accent color used across the viewer (minimap buttons,
 * navigation links, info hotspots). Falls back to the default blue when the
 * project does not define one.
 */
export function getAccentColor(project: Project | null | undefined): string {
  const color = project?.project?.accentColor?.trim();
  return color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : DEFAULT_ACCENT_COLOR;
}

/**
 * Derives a darker shade of a hex color (used for hover/borders).
 */
export function darkenHex(hex: string, amount = 0.2): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized.padEnd(6, '0').slice(0, 6);

  const num = parseInt(full, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
