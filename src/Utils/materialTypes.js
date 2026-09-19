// Central helpers for the material-type selection.
// state.materialType can now be a single id OR an array of ids (multi-select
// on the Select Material Type step). Every consumer should go through these
// helpers instead of comparing the raw value.

export const MATERIAL_TYPE_LABELS = {
  all: 'All',
  diamond: 'Diamond/Solitaire',
  colorstone: 'ColorStone/Gemstone',
  misc: 'Misc',
  findings: 'Findings',
};

export const MATERIAL_TYPE_ITEMIDS = {
  all: null,
  diamond: [3],
  colorstone: [4],
  misc: [7],
  findings: [5],
};

export const toMaterialTypeList = (materialType) => {
  if (Array.isArray(materialType)) return materialType.filter(Boolean);
  if (materialType === null || materialType === undefined || materialType === '') return [];
  return [materialType];
};

// Allowed itemids for the selection. null = no filtering ('all' / nothing).
export const materialTypeItemIds = (materialType) => {
  const list = toMaterialTypeList(materialType);
  if (!list.length || list.includes('all')) return null;
  const ids = new Set();
  list.forEach((t) => (MATERIAL_TYPE_ITEMIDS[t] || []).forEach((id) => ids.add(id)));
  return ids.size ? [...ids] : null;
};

// Does a material/engaged row pass the current material-type selection?
export const materialTypeFilter = (row, materialType) => {
  const allowed = materialTypeItemIds(materialType);
  return !allowed || allowed.includes(row.itemid);
};

// Bag records carry a string `type` ("Diamond", "Diamond:S", "Colorstone:G",
// "Finding", "Misc") rather than itemid in some places.
export const materialTypeMatchesBagType = (bagType, materialType) => {
  const list = toMaterialTypeList(materialType).map((t) => String(t).toLowerCase());
  if (!list.length || list.includes('all')) return true;
  const t = String(bagType || '').toLowerCase();
  return list.some((mt) => {
    if (mt === 'diamond') return t === 'diamond' || t === 'diamond:s';
    if (mt === 'colorstone') return t === 'colorstone' || t === 'colorstone:g';
    if (mt === 'misc') return t === 'misc';
    if (mt === 'findings') return t === 'finding';
    return true;
  });
};

export const materialTypeLabel = (materialType, suffix = '') => {
  const list = toMaterialTypeList(materialType);
  if (!list.length || list.includes('all')) return 'All' + suffix;
  return list.map((t) => MATERIAL_TYPE_LABELS[t] || t).join(', ') + suffix;
};
