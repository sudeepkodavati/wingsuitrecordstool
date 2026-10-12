import type { RecordType, Viewpoint } from '../types';

export const VIEWPOINTS: Viewpoint[] = ['top-down', 'back-to-front'];

export const VIEWPOINT_LABELS: Record<Viewpoint, string> = {
  'top-down': 'Top-down view',
  'back-to-front': 'Back-to-front view',
};

export const VIEWPOINT_DESCRIPTIONS: Record<Viewpoint, string> = {
  'top-down': 'Looking down on the formation from above.',
  'back-to-front': 'Looking at the formation from behind, toward the front.',
};

export const DEFAULT_VIEWPOINT: Viewpoint = 'top-down';

/** Vertical formations are usually drawn from behind; everything else from above. */
export function suggestedViewpoint(type: RecordType | ''): Viewpoint {
  return type.endsWith('-vertical') ? 'back-to-front' : 'top-down';
}

export function isViewpoint(v: unknown): v is Viewpoint {
  return v === 'top-down' || v === 'back-to-front';
}
