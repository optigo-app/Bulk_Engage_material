import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Gem, Palette, Wrench, Stone, Package, ScanLine, Plus,
  CheckCircle2, AlertCircle, X, Info, Save, Pencil, RotateCcw,
} from 'lucide-react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import './BulkMaterialWise.scss';
import { getMaster, isMasterKey } from '../../../Utils/masterStore';

// ─── Utilities ────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').trim().toUpperCase();
const isSolitaire = (m) => Number(m?.is_sol_gem) === 1;
const getSession = (key) => { if (isMasterKey(key)) return getMaster(key, []); try { const r = sessionStorage.getItem(key); return r ? JSON.parse(r) : []; } catch { return []; } };

const getEngagedTotals = (AllEngagedMaterial, jobNosOrStr, row) => {
  const jobNos = Array.isArray(jobNosOrStr) ? jobNosOrStr : [jobNosOrStr];
  const matches = (AllEngagedMaterial || []).filter(e => {
    if (!e.isengage) return false;
    if (!jobNos.some(j => norm(e.serialjobno) === norm(j))) return false;
    if (e.itemid !== row.itemid) return false;
    if (isSolitaire(row) !== isSolitaire(e)) return false;
    if (row.itemid === 5) {
      return norm(e.findingtypename || '') === norm(row.findingtypename || '') &&
        norm(e.findingAccessories || '') === norm(row.findingAccessories || '');
    }
    return norm(e.shape || '') === norm(row.shape || '') &&
      norm(e.Quality || '') === norm(row.quality || '') &&
      norm(e.color || '') === norm(row.color || '') &&
      norm(e.Size || '') === norm(row.size || '');
  });
  if (!matches.length) return null;
  const pcs = matches.reduce((s, e) => s + (e.isspcs || 0), 0);
  const wt = matches.reduce((s, e) => s + (e.isswt || 0), 0);
  if (pcs === 0 && wt === 0) return null;

  const txnids = [...new Set(
    matches.map((e) => e.txnid).filter((t) => t !== undefined && t !== null && t !== '')
  )];
  const txnid = txnids.length ? txnids.join(',') : null;
  const rfbags = [...new Set(
    matches.map((e) => e.rfbag).filter((b) => b !== undefined && b !== null && b !== '')
  )];
  const rfbag = rfbags.length ? rfbags.join(', ') : null;
  return { pcs, wt, txnid, rfbag };
};


const findMatchingBag = (line, scannedBags) =>
  scannedBags.find(
    (b) =>
      b.itemid === line.itemid &&
      isSolitaire(b) === isSolitaire(line) &&
      norm(b.shape) === norm(line.shape) &&
      norm(b.quality) === norm(line.Quality) &&
      norm(b.color_name) === norm(line.color) &&
      norm(b.size) === norm(line.size) &&
      (!isSolitaire(line) || !line.stone_uniqueno || !b.stone_uniqueno ||
        norm(b.stone_uniqueno) === norm(line.stone_uniqueno))
  ) || null;

const findBagById = (id, pool) =>
  pool.find((b) => norm(b.rfbag) === norm(id) || norm(b.rfbag).endsWith(norm(id))) || null;

const matColor = (item = '', isSol = false) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return '#6343f1';
  if (u.includes('DIAMOND')) return '#e91e63';
  if (u.includes('COLORSTONE')) return '#9c27b0';
  if (u.includes('FINDING') || u.includes('MISC')) return '#ff9800';
  return '#607d8b';
};

const matIcon = (item = '', isSol = false, size = 13) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return <Stone size={size} />;
  if (u.includes('DIAMOND')) return <Gem size={size} />;
  if (u.includes('COLORSTONE')) return <Palette size={size} />;
  if (u.includes('FINDING') || u.includes('MISC')) return <Wrench size={size} />;
  return <Package size={size} />;
};

const matLabel = (item = '', isSol = false) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return 'Diamond:S';
  if (u.includes('DIAMOND')) return 'Diamond';
  if (u.includes('COLORSTONE')) return 'Colorstone';
  if (u.includes('FINDING')) return 'Finding';
  return item;
};

const groupKey = (line) =>
  `${norm(line.item)}|${isSolitaire(line) ? '1' : '0'}|${norm(line.shape)}|${norm(line.Quality)}|${norm(line.color)}|${norm(line.size)}|${norm(line.findingtypename)}|${norm(line.findingAccessories)}`;

const MATERIAL_ITEMID_MAP = { all: null, diamond: [3], colorstone: [4], misc: [7], findings: [5], Solitore: [3] };

const materialTypeFilter = (m, materialType) => {
  if (!materialType || materialType === 'all') return true;
  if (materialType === 'Solitore') return m.itemid === 3 && isSolitaire(m);
  if (materialType === 'diamond') return m.itemid === 3 && !isSolitaire(m);
  if (materialType === 'colorstone') return m.itemid === 4;
  if (materialType === 'misc') return m.itemid === 7;
  if (materialType === 'findings') return m.itemid === 5;
  const allowed = MATERIAL_ITEMID_MAP[materialType];
  return !allowed || allowed.includes(m.itemid);
};

const convertRawBagToScanned = (rawBag) => {
  const sol = isSolitaire(rawBag);
  return {
    id: rawBag.rfbag, label: rawBag.rfbag, rfbag: rawBag.rfbag,
    itemid: rawBag.itemid,
    is_sol_gem: rawBag.is_sol_gem || 0,
    stone_uniqueno: rawBag.stone_uniqueno || '',
    type: sol ? 'Diamond:S' : (rawBag.itemid === 3 ? 'Diamond' : rawBag.itemid === 4 ? 'Colorstone' : rawBag.itemid === 5 ? 'Finding' : 'Misc'),
    color: sol ? '#6343f1' : (rawBag.itemid === 3 ? '#e91e63' : rawBag.itemid === 4 ? '#9c27b0' : '#ff9800'),
    shape: rawBag.shape, quality: rawBag.Quality, size: rawBag.Size,
    wt: rawBag.wt, pcs: rawBag.pcs, supplier: rawBag.supplier,
    color_name: rawBag.color, shapeid: rawBag.shapeid,
  };
};

/**
 * Build merged material rows from scannedJobMaterialData.
 * Rows with identical (item, shape, Quality, color, size) are MERGED.
 */
const buildMergedRows = (ScannedMaterials, scannedJobs, ScannedBags, materialType = 'all') => {
  const serials = new Set(scannedJobs.map((j) => norm(j.id)));
  const lines = ScannedMaterials
    .filter((d) => serials.has(norm(d.SerialJobNo)))
    .filter((d) => materialTypeFilter(d, materialType));

  const map = new Map();
  lines.forEach((line) => {
    // One row per JOB + spec — do NOT combine the same spec across jobs.
    // (Lines that share the same spec WITHIN a single job are still merged.)
    const key = `${norm(line.SerialJobNo)}||${groupKey(line)}`;
    if (!map.has(key)) {
      const autoMatch = ScannedBags.find(b => b.qid === line.qid && b.jid === line.jid) ||
        findMatchingBag(line, ScannedBags);
      const bag = autoMatch ? {
        rfbag: autoMatch.rfbag,
        pcs: autoMatch.rempcs ?? autoMatch.pcs ?? Number(autoMatch.scannedPcs || 0),
        wt: autoMatch.remwt ?? autoMatch.wt ?? Number(autoMatch.scannedCwt || 0),
        // ── carry the owner flag through so the Company/Customer badge
        // can render on the bag chip, same as BulkSingleEntry ──
        iscompany: autoMatch.iscompany,
      } : null;
      map.set(key, {
        rowKey: key,
        item: line.item || (isSolitaire(line) ? 'DIAMOND:S' : ''),
        itemid: line.itemid,
        is_sol_gem: line.is_sol_gem || 0,
        stone_uniqueno: line.stone_uniqueno || '',
        MaterialTypeName: line.MaterialTypeName || '',
        shape: line.shape || '',
        quality: line.Quality || '',
        color: line.color || '',
        size: line.size || line.customsize || '',
        findingtypename: line.findingtypename || '',
        findingAccessories: line.findingAccessories || '',
        reqPcs: 0, reqWt: 0,
        matchedBag: bag,
        manualBag: null,
        jobNos: [],
        qids: [], jids: [],
        txnid: null,
      });
    }
    const row = map.get(key);
    row.reqPcs += line.pcs || 0;
    row.reqWt += line.wt || 0;
    row.jobNos.push(line.SerialJobNo);
    row.qids.push(line.qid);
    row.jids.push(line.jid);
  });

  map.forEach((row) => {
    row.jobNos = [...new Set(row.jobNos)];
  });

  return [...map.values()];
};

const FILTERS = ['ALL', 'Diamond', 'Colorstone', 'Finding', 'MISC'];

// ─── Add Material Modal ───────────────────────────────────────────────────────
const AddMaterialModal = ({ onAdd, onClose, scannedBags, AllBagListData, scannedJobList, selectedLockerName }) => {
  const [val, setVal] = useState('');
  const [error, setError] = useState('');
  const [found, setFound] = useState(null);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const check = () => {
    const t = val.trim();
    if (!t) return;
    let bag = findBagById(t, scannedBags);
    if (bag) {
      bag = {
        rfbag: bag.rfbag, itemid: bag.itemid,
        shape: bag.shape, quality: bag.quality || bag.Quality || '',
        size: bag.size || bag.Size || '', color_name: bag.color_name || bag.color || '',
        findingtypename: bag.findingtypename || '',
        findingAccessories: bag.findingAccessories || '',
        pcs: bag.rempcs ?? bag.pcs ?? Number(bag.scannedPcs ?? 0),
        wt: bag.remwt ?? bag.wt ?? Number(bag.scannedCwt ?? 0),
        iscompany: bag.iscompany,
      };
    }
    if (!bag) {
      const raw = findBagById(t, AllBagListData);
      if (raw) {
        bag = {
          rfbag: raw.rfbag, itemid: raw.itemid,
          shape: raw.shape, quality: raw.Quality || '', size: raw.Size || raw.size || '',
          color_name: raw.color || '',
          findingtypename: raw.findingtypename || '',
          findingAccessories: raw.findingAccessories || '',
          pcs: raw.rempcs ?? raw.pcs ?? 0,
          wt: raw.remwt ?? raw.wt ?? 0,
          iscompany: raw.iscompany,
        };
      }
    }
    if (!bag) { setError(`Bag "${t}" not found in system.`); setFound(null); }
    else {
      const allBagLocker = AllBagListData.find((b) => norm(b.rfbag) === norm(bag.rfbag));
      const bagLockerName = (allBagLocker?.LockerName || bag.LockerName || '').replace(/\s/g, '');
      const selLockerName = (selectedLockerName || '').replace(/\s/g, '');
      if (bagLockerName && selLockerName && bagLockerName !== selLockerName) {
        setError(`Bag "${bag.rfbag}" belongs to locker "${allBagLocker?.LockerName}" — not allowed for selected locker "${selectedLockerName}".`);
        setFound(null);
        return;
      }
      if (bag.iscompany === 0) {
        const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bag.rfbag));
        const custCode = allBagFull?.istoreCust_Customercode || '';
        const jobCodes = new Set((scannedJobList || []).map((j) => norm(j.ccode)));
        if (custCode && !jobCodes.has(norm(custCode))) {
          setError(`Bag "${bag.rfbag}" belongs to "${allBagFull?.istoreCust_CustName || 'another customer'}" — not allowed for these jobs.`);
          setFound(null);
          return;
        }
      }
      setError('');
      setFound(bag);
    }
  };

  const confirm = () => {
    if (!found) return;
    onAdd(found);
    onClose();
  };

  return (
    <div className="bmw-modal-backdrop" onClick={onClose}>
      <div className="bmw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bmw-modal__close" onClick={onClose}><X size={15} /></button>
        <div className="bmw-modal__icon"><ScanLine size={24} /></div>
        <h3>Add Material via Bag</h3>
        <p>Scan or enter a bag barcode. Material details will be loaded from the system.</p>

        <div className="bmw-modal__row">
          <input
            ref={ref}
            className="bmw-modal__input"
            placeholder="e.g. 0000000048"
            value={val}
            onChange={(e) => { setVal(e.target.value); setError(''); setFound(null); }}
            onKeyDown={(e) => e.key === 'Enter' && check()}
          />
          <button className="bmw-modal__check-btn" onClick={check}>Check</button>
        </div>

        {error && (
          <div className="bmw-modal__error"><AlertCircle size={12} />{error}</div>
        )}

        {found && (
          <>
            <div className="bmw-modal__found">
              <CheckCircle2 size={13} />
              <div>
                <strong>{found.rfbag}</strong>
                <span>{found.shape} · {found.quality} · {found.color_name} · {found.size}</span>
                <span>Stock: {found.pcs} pcs / {Number(found.wt).toFixed(3)} ctw</span>
                {found.findingtypename && (
                  <span>{found.findingtypename}{found.findingAccessories ? ` · ${found.findingAccessories}` : ''}</span>
                )}
                <span className={`bmw-owner-badge ${found.iscompany == 1 ? 'bmw-owner-badge--company' : 'bmw-owner-badge--customer'}`}>
                  {found.iscompany == 1 ? 'Company' : 'Customer'}
                </span>
              </div>
            </div>
            <button className="bmw-modal__confirm-btn" onClick={confirm}>
              Add This Material
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Return / Edit Modal ─────────────────────────────────────────────────────
const ReturnModal = ({ rows, inputs, onSave, onUnlock, onClose }) => {
  const [localInputs, setLocalInputs] = useState(() => {
    const init = {};
    rows.forEach(r => {
      init[r.rowKey] = { ...(inputs[r.rowKey] || { pcs: '', cwt: '' }) };
    });
    return init;
  });

  const handleChange = (rowKey, field, val) =>
    setLocalInputs(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], [field]: val } }));

  return (
    <div className="bmw-modal-backdrop" onClick={onClose}>
      <div className="bmw-return-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bmw-modal__close" onClick={onClose}><X size={15} /></button>
        <h3><RotateCcw size={16} /> Return / Edit</h3>
        <p>Review and edit the engaged entries.</p>
        <div className="bmw-return-modal__table-wrap">
          <table className="bmw__table">
            <thead>
              <tr>
                <th className="bmw__th bmw__th--sr">Sr</th>
                <th className="bmw__th bmw__th--type">Material</th>
                <th className="bmw__th bmw__th--desc">Spec</th>
                <th className="bmw__th-sub bmw__th-sub--entry">PCS</th>
                <th className="bmw__th-sub bmw__th-sub--entry">CWT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const bag = row.matchedBag || row.manualBag;
                return (
                  <tr key={row.rowKey} className="bmw__row">
                    <td className="bmw__td bmw__td--sr">{idx + 1}</td>
                    <td className="bmw__td bmw__td--type">
                      <span className="bmw__mat" style={{ color: matColor(row.item, isSolitaire(row)) }}>
                        {matLabel(row.item, isSolitaire(row))}
                      </span>
                    </td>
                    <td
                      className="bmw__td bmw__td--desc"
                      style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}
                    >
                      {row.shape} · {row.quality} · {row.color}
                      {bag && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: '#374151' }}>{bag.rfbag}</span>{' '}
                          <span className={`bmw-owner-badge ${bag.iscompany == 1 ? 'bmw-owner-badge--company' : 'bmw-owner-badge--customer'}`}>
                            {bag.iscompany == 1 ? 'Company' : 'Customer'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="bmw__td bmw__td--entry">
                      <input type="number" className="bmw__inp"
                        value={localInputs[row.rowKey]?.pcs ?? ''}
                        onChange={(e) => handleChange(row.rowKey, 'pcs', e.target.value)} />
                    </td>
                    <td className="bmw__td bmw__td--entry">
                      <input type="number" step="0.001" className="bmw__inp"
                        value={localInputs[row.rowKey]?.cwt ?? ''}
                        onChange={(e) => handleChange(row.rowKey, 'cwt', e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bmw-return-modal__actions">
          <Button variant="contained" size="small" startIcon={<Save size={12} />}
            onClick={() => onSave(localInputs)}>
            Re-engage
          </Button>
          <Button variant="outlined" size="small" startIcon={<Pencil size={12} />}
            onClick={onUnlock}>
            Unlock Inline
          </Button>
        </div>
      </div>
    </div>
  );
};

const BulkMaterialWise = ({ state, actions, onRegisterContinue }) => {
  const [sessionData] = useState(() => ({
    ScannedMaterials: getSession('scannedJobMaterialData'),
    ScannedBags: getSession('scannedBagData'),
    AllBagListData: getSession('allBagListData'),
    AllEngagedMaterial: getSession('allEngagedMaterial'),
    ScannedJobList: getSession('scannedJobListData'),
  }));
  const { ScannedMaterials, ScannedBags, AllBagListData, AllEngagedMaterial, ScannedJobList } = sessionData;

  const jobs = state?.scannedJobs?.length > 0 ? state.scannedJobs : [];
  const matType = state?.materialType || 'all';
  const baseRows = useMemo(
    () => buildMergedRows(ScannedMaterials, jobs, ScannedBags, matType),
    // eslint-disable-next-line
    []
  );

  const [rows, setRows] = useState(baseRows);
  const [filter, setFilter] = useState('ALL');
  const [autoFill, setAutoFill] = useState(true);
  const [inputs, setInputs] = useState(() => {
    // 1) Build the baseline for every row from engaged totals (locked, committed
    //    data) or the required amount for a freshly-bagged row. This ALWAYS runs
    //    so values are shown even when saved data uses stale row keys.
    const init = {};
    baseRows.forEach((r) => {
      const engaged = getEngagedTotals(AllEngagedMaterial, r.jobNos || [], r);
      if (engaged) {
        init[r.rowKey] = { pcs: String(engaged.pcs), cwt: engaged.wt.toFixed(3) };
        r.txnid = engaged.txnid ?? null;
      } else {
        const bag = r.matchedBag;
        // Bag already connected → pre-fill the REAL required amount as an
        // editable value (not just a placeholder), same as BulkSingleEntry.
        init[r.rowKey] = { pcs: bag ? String(r.reqPcs) : '', cwt: bag ? r.reqWt.toFixed(3) : '' };
      }
    });
    // 2) Overlay any previously-saved values, but only where the rowKey still
    //    matches a current row (stale keys are ignored, keeping the baseline).
    const saved = state.jobEntries?.['bulk-material'];
    if (saved?.bags?.length) {
      saved.bags.forEach(b => {
        if (b.rowKey && init[b.rowKey] !== undefined) {
          init[b.rowKey] = { pcs: String(b.pcs ?? ''), cwt: String(b.wt ?? '') };
        }
        const r = baseRows.find(x => x.rowKey === b.rowKey);
        if (r && b.txnid) r.txnid = b.txnid;
      });
    }
    return init;
  });
  // Rows the user has "Returned" → their Entry fields are disabled (locked).
  const [returnedRows, setReturnedRows] = useState(() => new Set());
  const [engagedLocked, setEngagedLocked] = useState(() => {
    const locked = new Set();
    baseRows.forEach(r => {
      const engaged = getEngagedTotals(AllEngagedMaterial, r.jobNos || [], r);
      if (engaged) {
        locked.add(r.rowKey);
        r.engagedRfbag = engaged.rfbag ?? null;
      }
    });
    return locked;
  });
  const [inputErrors, setInputErrors] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [isSaved, setIsSaved] = useState(() => !!state.jobEntries?.['bulk-material']);
  const [returnModal, setReturnModal] = useState(false);

  // Per-row remaining CWT for a shared bag: the bag's available weight minus
  // the weight already committed to that same bag on every other row.
  const remainingCwtByRow = useMemo(() => {
    const usedByBag = {};
    rows.forEach((r) => {
      const b = r.matchedBag || r.manualBag;
      if (!b) return;
      const rf = norm(b.rfbag);
      usedByBag[rf] = (usedByBag[rf] || 0) + (parseFloat(inputs[r.rowKey]?.cwt) || 0);
    });
    const map = {};
    rows.forEach((r) => {
      const b = r.matchedBag || r.manualBag;
      if (!b) return;
      const rf = norm(b.rfbag);
      const avail = Number(b.wt) || 0;
      const thisUsed = parseFloat(inputs[r.rowKey]?.cwt) || 0;
      map[r.rowKey] = avail - ((usedByBag[rf] || 0) - thisUsed);
    });
    return map;
  }, [rows, inputs]);

  const handleSaveAll = () => {
    if (Object.values(inputErrors).some(Boolean)) return;
    if (rows.some((r) => {
      const b = r.matchedBag || r.manualBag;
      return b && !engagedLocked.has(r.rowKey) && !(parseFloat(inputs[r.rowKey]?.cwt) > 0);
    })) return;
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey,
        qid: r.qids?.[0] ?? null,
        jid: r.jids?.[0] ?? null,
        isUnusedBag: !(r.qids?.length),
        item: r.item,
        itemid: r.itemid,
        is_sol_gem: r.is_sol_gem || 0,
        stone_uniqueno: r.stone_uniqueno || '',
        MaterialTypeName: r.MaterialTypeName,
        shape: r.shape,
        quality: r.quality,
        color: r.color,
        size: r.size,
        findingtypename: r.findingtypename || '',
        findingAccessories: r.findingAccessories || '',
        requiredPcs: r.reqPcs,
        requiredWt: r.reqWt,
        rfbag: bag?.rfbag || null,
        bag: bag ? { rfbag: bag.rfbag } : null,
        iscompany: bag?.iscompany ?? null,
        pcs: parseFloat(inputs[r.rowKey]?.pcs) || 0,
        wt: parseFloat(inputs[r.rowKey]?.cwt) || 0,
        txnid: r.txnid ?? 0,
      };
    });
    actions?.updateJobEntry?.('bulk-material', { bags: entries });
    setIsSaved(true);
  };

  const handleReturnSave = (updatedInputs) => {
    setInputs((prev) => ({ ...prev, ...updatedInputs }));
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, qid: r.qids?.[0] ?? null, jid: r.jids?.[0] ?? null,
        isUnusedBag: !(r.qids?.length),
        item: r.item, itemid: r.itemid,
        is_sol_gem: r.is_sol_gem || 0,
        stone_uniqueno: r.stone_uniqueno || '',
        rfbag: bag?.rfbag || null,
        shape: r.shape, quality: r.quality, color: r.color, size: r.size,
        findingtypename: r.findingtypename || '',
        findingAccessories: r.findingAccessories || '',
        bag: bag ? { rfbag: bag.rfbag } : null,
        iscompany: bag?.iscompany ?? null,
        pcs: parseFloat(updatedInputs[r.rowKey]?.pcs) || 0,
        wt: parseFloat(updatedInputs[r.rowKey]?.cwt) || 0,
        txnid: r.txnid ?? 0,
      };
    });
    actions?.updateJobEntry?.('bulk-material', { bags: entries });
    setReturnModal(false);
  };

  const handleReturnUnlock = () => {
    setIsSaved(false);
    setReturnModal(false);
  };

  // "Return" disables (locks) the row's Entry fields; clicking again ("Edit")
  // re-enables them for editing.
  const toggleReturnRow = (rowKey) => {
    setReturnedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  // Register save handler with parent so "Continue to Summary" persists data
  const saveRef = useRef(handleSaveAll);
  saveRef.current = handleSaveAll;
  useEffect(() => {
    if (onRegisterContinue) {
      onRegisterContinue(() => saveRef.current());
      return () => onRegisterContinue(null);
    }
  }, [onRegisterContinue]);

  // Auto-save: persist automatically (debounced) whenever any entry changes,
  // so no manual "Save" button is needed.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    const t = setTimeout(() => saveRef.current(), 400);
    return () => clearTimeout(t);
  }, [inputs, rows]);

  useEffect(() => {
    setInputs((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        // Engaged/locked rows hold committed data — never clobber them.
        if (engagedLocked.has(r.rowKey)) return;
        const bag = r.matchedBag || r.manualBag;
        if (!bag) return;
        if (autoFill) {
          next[r.rowKey] = { pcs: String(r.reqPcs), cwt: r.reqWt.toFixed(3) };
        } else {
          next[r.rowKey] = { pcs: '', cwt: '' };
        }
      });
      return next;
    });
  }, [autoFill, rows]); // eslint-disable-line

  const handleInput = (rowKey, field, val) => {
    setInputs((prev) => {
      const nextInputs = { ...prev, [rowKey]: { ...prev[rowKey], [field]: val } };
      const row = rows.find(r => r.rowKey === rowKey);
      const bag = row?.matchedBag || row?.manualBag;
      // Only CWT is capped: total weight pulled from a bag across ALL rows/jobs
      // shown here must not exceed the bag's available weight. PCS is not capped.
      if (bag && field === 'cwt') {
        const avail = Number(bag.wt) || 0;
        const target = norm(bag.rfbag);
        let otherUsed = 0;
        rows.forEach((r) => {
          if (r.rowKey === rowKey) return;
          const rb = r.matchedBag || r.manualBag;
          if (rb && norm(rb.rfbag) === target) otherUsed += parseFloat(nextInputs[r.rowKey]?.cwt) || 0;
        });
        const remaining = avail - otherUsed;
        setInputErrors((pe) => ({ ...pe, [`${rowKey}-cwt`]: avail > 0 && (parseFloat(val) || 0) > remaining + 1e-6 }));
      }
      return nextInputs;
    });
  };

  // Add material from modal
  const handleAddMaterial = (bag) => {
    const bagIsSol = isSolitaire(bag);
    const item = bagIsSol ? 'DIAMOND:S' : (bag.itemid === 3 ? 'DIAMOND' : bag.itemid === 4 ? 'COLORSTONE' : 'FINDING');
    const key = `${norm(item)}|${bagIsSol ? '1' : '0'}|${norm(bag.shape)}|${norm(bag.quality)}|${norm(bag.color_name)}|${norm(bag.size)}`;

    // If spec already exists, just assign this bag to that row
    const existing = rows.find((r) => r.rowKey === key);
    if (existing) {
      setRows((prev) =>
        prev.map((r) => r.rowKey === key ? { ...r, manualBag: bag } : r)
      );
      if (autoFill) {
        setInputs((prev) => ({
          ...prev,
          [key]: { pcs: String(existing.reqPcs), cwt: existing.reqWt.toFixed(3) },
        }));
      }
      return;
    }

    // New row
    const newRow = {
      rowKey: key,
      item,
      itemid: bag.itemid,
      is_sol_gem: bag.is_sol_gem || 0,
      stone_uniqueno: bag.stone_uniqueno || '',
      shape: bag.shape,
      quality: bag.quality,
      color: bag.color_name,
      size: bag.size,
      reqPcs: 0,
      reqWt: 0,
      matchedBag: null,
      manualBag: bag,
      jobNos: [],
      qids: [], jids: [],
      txnid: null,
    };
    setRows((prev) => [...prev, newRow]);
    setInputs((prev) => ({
      ...prev,
      [key]: { pcs: '', cwt: '' },
    }));
  };

  // Filter + group
  const filtered = filter === 'ALL'
    ? rows
    : rows.filter((r) => matLabel(r.item, isSolitaire(r)) === filter);

  const grouped = filtered.reduce((acc, r) => {
    const k = matLabel(r.item, isSolitaire(r)).toUpperCase();
    if (!acc[k]) acc[k] = { item: r.item, isSol: isSolitaire(r), rows: [] };
    acc[k].rows.push(r);
    return acc;
  }, {});

  // Summary totals
  const totReq = rows.reduce((a, r) => a + r.reqWt, 0);
  const totEntry = rows.reduce((a, r) => {
    const v = parseFloat(inputs[r.rowKey]?.cwt);
    return a + (isNaN(v) ? 0 : v);
  }, 0);
  const baggedCount = rows.filter((r) => r.matchedBag || r.manualBag).length;
  const totalCount = rows.length;

  // sr counter
  let srCounter = 1;

  return (
    <div className="bmw-layout">
      <div className="bmw">
        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div className="bmw__toolbar">
          <div className="bmw__toolbar-left">
            {/* Filter */}
            <div className="bmw__filter">
              <span className="bmw__filter-label">Material</span>
              <FormControl size="small">
                <Select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bmw__filter-select"
                >
                  {FILTERS.map((f) => (
                    <MenuItem key={f} value={f} sx={{ fontSize: 12 }}>{f}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* Add */}
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={13} />}
              className="bmw__add-btn"
              onClick={() => setShowModal(true)}
            >
              Add Material
            </Button>

            {/* Auto fill */}
            <FormControlLabel
              className="bmw__autofill"
              control={
                <Checkbox
                  checked={autoFill}
                  onChange={(e) => setAutoFill(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label="Auto Fill"
            />
          </div>

          {/* Summary */}
          <div className="bmw__summary-bar">
            <div className="bmw__summary-cell">
              <span className="bmw__summary-val">{baggedCount}/{totalCount}</span>
              <span className="bmw__summary-lbl">Bags Assigned</span>
            </div>
            <div className="bmw__summary-cell">
              <span className="bmw__summary-val">{totReq.toFixed(3)}</span>
              <span className="bmw__summary-lbl">Req. CTW / Gms</span>
            </div>
            <div className="bmw__summary-cell bmw__summary-cell--green">
              <span className="bmw__summary-val">{totEntry.toFixed(3)}</span>
              <span className="bmw__summary-lbl">Entry CTW / Gms</span>
            </div>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────── */}
        <div className="bmw__table-wrap">
          {rows.length === 0 ? (
            <div className="bmw__no-data">
              <Info size={16} />
              <span>No material lines found for the scanned jobs.</span>
            </div>
          ) : (
            <table className="bmw__table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead className="bmw__thead">
                <tr>
                  <th className="bmw__th bmw__th--sr">Sr</th>
                  <th className="bmw__th bmw__th--type">Material / Bag</th>
                  <th className="bmw__th bmw__th--desc">Specification</th>
                  <th className="bmw__th bmw__th--jobs">Jobs</th>
                  <th className="bmw__th-sub">Req. PCS</th>
                  <th className="bmw__th-sub">Req. CTW / Gms</th>
                  <th className="bmw__th-sub bmw__th-sub--entry">Entry PCS</th>
                  <th className="bmw__th-sub bmw__th-sub--entry">Entry CWT</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([groupName, { item, isSol, rows: gRows }]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bmw__group-row">
                      <td colSpan={8}>
                        <div className="bmw__group-label" style={{ '--gc': matColor(item, isSol) }}>
                          {groupName}
                        </div>
                      </td>
                    </tr>

                    {gRows.map((row) => {
                      const bag = row.matchedBag || row.manualBag;
                      const isAuto = !!row.matchedBag;
                      const inp = inputs[row.rowKey] || { pcs: '', cwt: '' };
                      const sr = srCounter++;
                      const color = matColor(row.item, isSolitaire(row));
                      const isEngagedLockedRow = engagedLocked.has(row.rowKey);

                      return (
                        <tr
                          key={row.rowKey}
                          className={`bmw__row ${bag ? 'bmw__row--bag' : 'bmw__row--nobag'}`}
                        >
                          {/* Sr */}
                          <td className="bmw__td bmw__td--sr" style={{ verticalAlign: 'top' }}>{sr}</td>

                          {/* Material + bag (two-line chip: rfbag + owner badge, same as BulkSingleEntry) */}
                          <td className="bmw__td bmw__td--type" style={{ verticalAlign: 'top' }}>
                            {row.engagedRfbag ? (
                              <div className="bmw__engaged-lock-bag">
                                <Package size={11} /> {row.engagedRfbag}
                              </div>
                            )
                              : bag ? (
                                <span
                                  className={`bmw__chip bmw__chip--${isAuto ? bag.iscompany == 1 ? 'autocomp' : 'autoccust' : 'manual'}`}
                                  style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}
                                >
                                  <span>{bag.rfbag}</span>
                                  <span
                                    className={`bmw-owner-badge ${bag.iscompany == 1 ? 'bmw-owner-badge--company' : 'bmw-owner-badge--customer'}`}
                                  >
                                    {bag.iscompany == 1 ? 'Company' : 'Customer'}
                                  </span>
                                </span>
                              ) : (
                                <span className="bmw__chip bmw__chip--none">No bag</span>
                              )}
                          </td>

                          {/* Spec — word-wrap fixed so long don't overlap the next row */}
                          <td
                            className="bmw__td bmw__td--desc"
                            style={{ verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}
                          >
                            {row.shape} · {row.quality} · {row.color}
                            {row.size ? ` · ${row.size}` : ''}
                          </td>

                          {/* Jobs */}
                          <td className="bmw__td bmw__td--jobs" style={{ verticalAlign: 'top' }}>
                            {row.jobNos.length > 0
                              ? row.jobNos.map((j) => (
                                <span key={j} className="bmw__job-chip">{j}</span>
                              ))
                              : <span className="bmw__muted">—</span>
                            }
                          </td>

                          {/* Required */}
                          <td className="bmw__td bmw__td--num" style={{ verticalAlign: 'top' }}>{row.reqPcs}</td>
                          <td className="bmw__td bmw__td--num" style={{ verticalAlign: 'top' }}>{row.reqWt.toFixed(3)}</td>

                          {/* Entry + Available hint */}
                          {(() => {
                            const isExhausted = !isEngagedLockedRow && bag && (bag.pcs ?? 0) <= 0 && (Number(bag.wt) ?? 0) <= 0;
                            const pcsErr = inputErrors[`${row.rowKey}-pcs`];
                            const cwtErr = inputErrors[`${row.rowKey}-cwt`];

                            // ── Engaged row: editable by default. Clicking
                            //    "Return" DISABLES (locks) the fields; clicking
                            //    "Edit" re-enables them. ──
                            if (isEngagedLockedRow) {
                              const isReturned = returnedRows.has(row.rowKey);
                              return (<>
                                <td className="bmw__td bmw__td--entry" style={{ verticalAlign: 'top' }}>
                                  <div className="bmw__entry-cell">
                                    <input type="number"
                                      className={`bmw__inp ${!isReturned ? 'bmw__inp--disabled' : pcsErr ? 'bmw__inp--error' : ''}`}
                                      disabled={!isReturned}
                                      value={inp.pcs}
                                      onChange={(e) => handleInput(row.rowKey, 'pcs', e.target.value)} />
                                  </div>
                                </td>
                                <td className="bmw__td bmw__td--entry" style={{ verticalAlign: 'top' }}>
                                  <div className="bmw__entry-cell">
                                    <input type="number" step="0.001"
                                      className={`bmw__inp ${!isReturned ? 'bmw__inp--disabled' : cwtErr ? 'bmw__inp--error' : ''}`}
                                      disabled={!isReturned}
                                      value={inp.cwt}
                                      onChange={(e) => handleInput(row.rowKey, 'cwt', e.target.value)} />
                                    {!isReturned &&
                                      <button className="bmw__return-btn" onClick={() => toggleReturnRow(row.rowKey)}>
                                        Return
                                      </button>
                                    }
                                  </div>
                                </td>
                              </>);
                            }

                            return (<>
                              <td className="bmw__td bmw__td--entry" style={{ position: 'relative', verticalAlign: 'top' }}>
                                {isExhausted
                                  ? <span className="bmw__exhausted-cell">Scan other bag</span>
                                  : <div className="bmw__entry-cell">
                                    <input type="number"
                                      className={`bmw__inp ${!bag ? 'bmw__inp--disabled' : pcsErr ? 'bmw__inp--error' : ''}`}
                                      placeholder={bag ? String(row.reqPcs) : 'No bag'}
                                      disabled={!bag}
                                      value={inp.pcs}
                                      onChange={(e) => handleInput(row.rowKey, 'pcs', e.target.value)} />
                                    {bag && <span className={`bmw__avl-hint ${pcsErr ? 'bmw__avl-hint--error' : ''}`}>
                                      {pcsErr ? `Max ${bag.pcs}` : `Avl: ${bag.pcs}`}
                                    </span>}
                                  </div>
                                }
                              </td>
                              <td className="bmw__td bmw__td--entry" style={{ verticalAlign: 'top' }}>
                                {isExhausted
                                  ? <span className="bmw__exhausted-cell">0 stock</span>
                                  : <div className="bmw__entry-cell">
                                    <input type="number" step="0.001"
                                      className={`bmw__inp ${!bag ? 'bmw__inp--disabled' : cwtErr ? 'bmw__inp--error' : ''}`}
                                      placeholder={bag ? row.reqWt.toFixed(3) : 'No bag'}
                                      disabled={!bag}
                                      value={inp.cwt}
                                      onChange={(e) => handleInput(row.rowKey, 'cwt', e.target.value)} />
                                    {bag && <span className={`bmw__avl-hint ${cwtErr ? 'bmw__avl-hint--error' : ''}`}>
                                      {(() => {
                                        const rem = remainingCwtByRow[row.rowKey] ?? Number(bag.wt);
                                        return cwtErr ? `Max ${Number(rem).toFixed(3)}` : `Avl: ${Number(rem).toFixed(3)}`;
                                      })()}
                                    </span>}
                                  </div>
                                }
                              </td>
                            </>);
                          })()}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Summary sidebar */}
      <div className="bmw-sidebar">
        <div className="bmw-sidebar__title">Summary</div>
        <div className="bmw-sidebar__stats">
          <div className="bmw-sidebar__stat">
            <span className="bmw-sidebar__stat-val">{baggedCount}/{totalCount}</span>
            <span className="bmw-sidebar__stat-lbl">Bags Assigned</span>
          </div>
          <div className="bmw-sidebar__stat">
            <span className="bmw-sidebar__stat-val">{totReq.toFixed(3)}</span>
            <span className="bmw-sidebar__stat-lbl">Required CTW / Gms</span>
          </div>
          <div className="bmw-sidebar__stat bmw-sidebar__stat--green">
            <span className="bmw-sidebar__stat-val">{totEntry.toFixed(3)}</span>
            <span className="bmw-sidebar__stat-lbl">Entry CTW / Gms</span>
          </div>
        </div>
        <div className="bmw-sidebar__groups">
          {Object.entries(grouped).map(([groupName, { item, rows: gRows }]) => {
            const gBagged = gRows.filter(r => r.matchedBag || r.manualBag).length;
            const gReq = gRows.reduce((a, r) => a + r.reqWt, 0);
            return (
              <div key={groupName} className="bmw-sidebar__group">
                <div className="bmw-sidebar__group-head">
                  <strong>{groupName}</strong>
                  <span className="bmw-sidebar__group-count">{gBagged}/{gRows.length}</span>
                </div>
                <div className="bmw-sidebar__group-detail">
                  <span>{gRows.reduce((a,r) => a + r.reqPcs, 0)} pcs</span>
                  <span>&middot;</span>
                  <span>{gReq.toFixed(3)} {groupName == "FINDING" || groupName == "MISC" ? "gms" : 'ctw'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <AddMaterialModal
          onAdd={handleAddMaterial}
          onClose={() => setShowModal(false)}
          scannedBags={ScannedBags}
          AllBagListData={AllBagListData}
          scannedJobList={ScannedJobList}
          selectedLockerName={state.locker?.name || ''}
        />
      )}
      {returnModal && (
        <ReturnModal
          rows={rows}
          inputs={inputs}
          matColor={matColor}
          matIcon={matIcon}
          matLabel={matLabel}
          onSave={handleReturnSave}
          onUnlock={handleReturnUnlock}
          onClose={() => setReturnModal(false)}
        />
      )}
    </div>
  );
};

export default BulkMaterialWise;