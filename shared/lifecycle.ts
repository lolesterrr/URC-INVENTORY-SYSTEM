/**
 * Hardware lifecycle rules, shared by the server (which enforces them) and the UI (which only offers allowed moves).
 * No imports: this file is bundled into the browser.
 */
export const LIFECYCLE_STATES = ['In Stock', 'Deployed', 'In Repair', 'Retired', 'Disposed'] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** Allowed moves between lifecycle states. Disposed is final. */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  'In Stock': ['Deployed', 'In Repair', 'Retired'],
  Deployed: ['In Stock', 'In Repair', 'Retired'],
  'In Repair': ['In Stock', 'Deployed', 'Retired'],
  Retired: ['In Stock', 'Disposed'],
  Disposed: [],
};

/** States that need a reason (e.g. board-of-survey reference) when an asset moves into them. */
export const NOTE_REQUIRED: readonly LifecycleState[] = ['Retired', 'Disposed'];

/** States a new asset may start in. Disposal always goes through Retired. */
export const INITIAL_STATES = ['In Stock', 'Deployed', 'In Repair', 'Retired'] as const satisfies readonly LifecycleState[];

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}
