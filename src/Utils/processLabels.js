/**
 * Display names for the engage-process types.
 *
 * The IDs ('single-single', 'bulk-bulk', ...) are used for routing in
 * MaterialEntry.js and must NOT change — only these labels are shown to
 * the user, so keep every screen (Select Process, Sidebar, Summary,
 * Confirmation) reading from here.
 */

// Step 1 — how many jobs are handled in one session.
export const PROCESS_TYPE_LABELS = {
  single: 'Single Job Engage',
  bulk: 'Multi Job Engage',
};

export const PROCESS_TYPE_DESC = {
  single: 'Issue raw material for one job at a time',
  bulk: 'Issue raw material for several jobs in one session',
};

// Step 2 — how the material of those jobs is entered.
export const PROCESS_SUBTYPE_LABELS = {
  'single-single': 'Item-by-Item Engage',
  'single-bulk': 'Complete Job Engage',
  'bulk-single': 'Job-wise Entry',
  'bulk-bulk': 'Material-wise (RM) Entry',
};

export const PROCESS_SUBTYPE_DESC = {
  'single-single': 'Scan one job, then scan and issue each material separately',
  'single-bulk': "Scan one job, then issue all of that job's materials together",
  'bulk-single': "All scanned jobs listed separately — enter each job's material",
  'bulk-bulk': 'All jobs merged — enter quantities material / RM wise',
};

export const processTypeLabel = (id) => PROCESS_TYPE_LABELS[id] || id || '—';

export const processSubTypeLabel = (id) => PROCESS_SUBTYPE_LABELS[id] || id || '—';
