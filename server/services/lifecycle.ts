import type { LifecycleState } from '../../shared/lifecycle';

const LEGACY_STATES: Record<string, LifecycleState> = {
  'in stock': 'In Stock',
  'in use': 'Deployed',
  deployed: 'Deployed',
  maintenance: 'In Repair',
  'in repair': 'In Repair',
  retired: 'Retired',
  disposed: 'Disposed',
};

/**
 * Splits a legacy free-text status into a lifecycle state and a condition note.
 * Same rules as migration 0002_lifecycle_states.sql: lifecycle words become the state; any other text is kept
 * as the condition, and the state follows the assignee.
 */
export function legacyStatusToLifecycle(status: string | undefined, assignedTo: string | undefined): { lifecycleState: LifecycleState; condition: string } {
  const text = (status ?? '').trim();
  const state = LEGACY_STATES[text.toLowerCase()];
  if (state) return { lifecycleState: state, condition: '' };
  const assigned = (assignedTo ?? '').trim();
  return { lifecycleState: assigned && assigned !== 'Unassigned' ? 'Deployed' : 'In Stock', condition: text };
}
