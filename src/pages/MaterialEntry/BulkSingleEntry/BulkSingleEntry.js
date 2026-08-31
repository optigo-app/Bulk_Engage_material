import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, ChevronsDown, ChevronsUp, ScanLine,
  Package, Gem, Palette, Wrench, Stone,
  CheckCircle2, Save, Plus, AlertCircle, X, Info, Pencil, RotateCcw,
} from 'lucide-react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import './Bulksingleentry.scss';
import { getMaster, isMasterKey } from '../../../Utils/masterStore';


// ─── Utilities ────────────────────────────────────────────────────────────────
const getSession = (key) => { if (isMasterKey(key)) return getMaster(key, []); try { const r = sessionStorage.getItem(key); return r ? JSON.parse(r) : []; } catch { return []; } };
const norm = (s) => String(s ?? '').trim().toUpperCase();

const isSolitaire = (m) => Number(m?.is_sol_gem) === 1;

const getEngagedTotals = (AllEngagedMaterial, serialJobNo, row) => {
  const matches = (AllEngagedMaterial || []).filter(e => {
    if (!e.isengage) return false;
    if (norm(e.serialjobno) !== norm(serialJobNo)) return false;
    if (e.itemid !== row.itemid) return false;
    // Solitaire must match solitaire, non-solitaire must match non-solitaire
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
  // Collect distinct txnids from matched engaged rows so we can persist
  // the correct txnid when this engaged amount is saved.
  const txnids = [...new Set(
    matches.map((e) => e.txnid).filter((t) => t !== undefined && t !== null && t !== '')
  )];
  const txnid = txnids.length ? txnids.join(',') : null;
  return { pcs, wt, txnid };
};

const findBagById = (id, pool) =>
  pool.find((b) => norm(b.rfbag) === norm(id) || norm(b.rfbag).endsWith(norm(id))) || null;

// ── Does a raw bag record's spec match a material row's spec? ──
const bagMatchesRow = (bag, row) => {
  if (bag.itemid !== row.itemid) return false;
  if (isSolitaire(row) !== isSolitaire(bag)) return false;
  if (row.itemid === 5) {
    return norm(bag.findingtypename || '') === norm(row.findingtypename || '') &&
      norm(bag.findingAccessories || '') === norm(row.findingAccessories || '');
  }
  return norm(bag.shape || '') === norm(row.shape || '') &&
    norm(bag.quality || '') === norm(row.quality || '') &&
    norm(bag.color_name || '') === norm(row.color || '') &&
    norm(bag.size || '') === norm(row.size || '');
};

const matColor = (item = '', isSol = false) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return '#6343f1';
  if (u.includes('DIAMOND')) return '#1565c0';
  if (u.includes('COLORSTONE')) return '#7b1fa2';
  if (u.includes('FINDING') || u.includes('MISC')) return '#e65100';
  return '#607d8b';
};

const matIcon = (item = '', isSol = false, size = 12) => {
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

const MATERIAL_ITEMID_MAP = { all: null, diamond: [3], colorstone: [4], misc: [7], findings: [5], Solitore: [3] };

// Filter function that handles solitaire (itemid 3 + is_sol_gem === 1)
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

// Item order for grouping: Diamond, Solitaire, Colorstone, Finding, Misc — used for
// both the initial row order and the sort applied for display.
const ITEM_ORDER = { 3: 1, 4: 2, 5: 3, 7: 4 };
const itemSortKey = (r) => {
  if (r.itemid === 3 && isSolitaire(r)) return 1.5; // between Diamond and Colorstone
  return ITEM_ORDER[r.itemid] ?? 99;
};

/**
 * Build rows from scannedJobMaterialData (real session data).
 */
const buildJobRows = (serialJobNo, ScannedMaterials, ScannedBags, materialType = 'all', requiredBags = [], scannedBagsCtx = []) => {
  const scannedRfbagSet = new Set(scannedBagsCtx.map(b => norm(b.rfbag)));
  return ScannedMaterials
    .filter(m => norm(m.SerialJobNo) === norm(serialJobNo))
    .filter(m => materialTypeFilter(m, materialType))
    .map((m, idx) => {
      const mIsSol = isSolitaire(m);
      const lineRequiredBags = requiredBags.filter(rb => rb.qid === m.qid && rb.jid === m.jid);
      const anyScanned = lineRequiredBags.some(rb => scannedRfbagSet.has(norm(rb.rfbag)));
      const hasRequired = lineRequiredBags.length > 0;

      // 1) exact qid+jid match
      const byQidJid = (m.qid != null && m.jid != null)
        ? ScannedBags.find(b => String(b.qid) === String(m.qid) && String(b.jid) === String(m.jid))
        : null;

      // 2) required-bag rfbag match (bag was scanned but qid/jid may differ)
      const scannedReqBag = lineRequiredBags
        .map(rb =>
          ScannedBags.find(b => norm(b.rfbag) === norm(rb.rfbag)) ||
          scannedBagsCtx.find(b => norm(b.rfbag) === norm(rb.rfbag))
        )
        .find(Boolean);

      // 3) spec match — color_name OR color, size OR Size fallbacks
      // Also match solitaire flag and stone_uniqueno for solitaire rows
      const bySpec = ScannedBags.find(b =>
        b.itemid === m.itemid &&
        isSolitaire(b) === mIsSol &&
        norm(b.shape || '') === norm(m.shape || '') &&
        norm(b.quality || b.Quality || '') === norm(m.Quality || '') &&
        norm(b.color_name || b.color || '') === norm(m.color || '') &&
        norm(b.size || b.Size || '') === norm(m.size || m.customsize || '') &&
        (!mIsSol || !m.stone_uniqueno || !b.stone_uniqueno ||
          norm(b.stone_uniqueno) === norm(m.stone_uniqueno))
      );

      // 4) rfbag-in-requiredBags fallback — only if that rfbag is in ScannedBags
      const byRequiredRfbag = lineRequiredBags.length > 0
        ? ScannedBags.find(b =>
          lineRequiredBags.some(rb => norm(rb.rfbag) === norm(b.rfbag))
        )
        : null;

      const autoMatch = byQidJid || scannedReqBag || bySpec || byRequiredRfbag || null;

      const bag = autoMatch ? {
        rfbag: autoMatch.rfbag,
        pcs: autoMatch.rempcs ?? autoMatch.pcs ?? Number(autoMatch.scannedPcs ?? 0),
        wt: autoMatch.remwt ?? autoMatch.wt ?? Number(autoMatch.scannedCwt ?? 0),
        iscompany: autoMatch.iscompany,
      } : null;

      return {
        rowKey: `${norm(serialJobNo)}||${m.qid ?? idx}`,
        qid: m.qid,
        jid: m.jid,
        item: m.item || (mIsSol ? 'DIAMOND:S' : ''),
        itemid: m.itemid,
        is_sol_gem: m.is_sol_gem || 0,
        stone_uniqueno: m.stone_uniqueno || '',
        MaterialTypeName: m.MaterialTypeName || '',
        shape: m.shape || '',
        quality: m.Quality || '',
        color: m.color || '',
        size: m.size || m.customsize || '',
        findingtypename: m.findingtypename || '',
        findingAccessories: m.findingAccessories || '',
        reqPcs: m.pcs ?? 0,
        reqWt: m.wt ?? 0,
        isUnusedBag: !hasRequired,
        requiredBagNotScanned: hasRequired && !anyScanned,
        requiredBagRfbag: (hasRequired && !anyScanned) ? lineRequiredBags[0].rfbag : null,
        matchedBag: bag,
        manualBag: null,
        txnid: null,
      };
    });
};

// ─── Job-wise Add Other Bag Modal ──────────────────────────────────────────────
// Scans/picks a bag and auto-assigns it to whichever pending row (in this job)
// matches its item / shape / quality / color / size — same pattern as
// SingleBulkEntry's global "Add Other Bag" modal.
const AddOtherBagModal = ({ jobId, rows, onAssign, onClose, scannedBags, AllBagListData, scannedJobList, selectedLockerName }) => {
  const [val, setVal] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const pendingRows = rows.filter((r) => !(r.matchedBag || r.manualBag));
  // A bag can now be assigned to several rows/jobs (limited by its CWT stock),
  // so we no longer hide already-assigned bags from the list.
  const availableScannedBags = scannedBags;

  const lookupBag = (idVal) => {
    let bag = findBagById(idVal, scannedBags);
    if (bag) {
      return {
        rfbag: bag.rfbag, itemid: bag.itemid,
        shape: bag.shape, quality: bag.quality || bag.Quality || '',
        size: bag.size || bag.Size || '', color_name: bag.color_name || bag.color || '',
        findingtypename: bag.findingtypename || '', findingAccessories: bag.findingAccessories || '',
        pcs: bag.rempcs ?? bag.pcs ?? Number(bag.scannedPcs ?? 0),
        wt: bag.remwt ?? bag.wt ?? Number(bag.scannedCwt ?? 0),
        iscompany: bag.iscompany,
      };
    }
    const raw = findBagById(idVal, AllBagListData);
    if (raw) {
      return {
        rfbag: raw.rfbag, itemid: raw.itemid,
        shape: raw.shape, quality: raw.Quality || '', size: raw.Size || raw.size || '',
        color_name: raw.color || '',
        findingtypename: raw.findingtypename || '', findingAccessories: raw.findingAccessories || '',
        pcs: raw.rempcs ?? raw.pcs ?? 0,
        wt: raw.remwt ?? raw.wt ?? 0,
        iscompany: raw.iscompany,
      };
    }
    return null;
  };

  const assignBagToMatchingRow = (bag) => {
    // ── Locker restriction: only allow bags from the currently selected locker ──
    {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bag.rfbag));
      const bagLockerName = (allBagFull?.LockerName || bag.LockerName || '').replace(/\s/g, '');
      const selLockerName = (selectedLockerName || '').replace(/\s/g, '');
      if (bagLockerName && selLockerName && bagLockerName !== selLockerName) {
        setError(`Bag "${bag.rfbag}" belongs to locker "${allBagFull?.LockerName}" — not allowed for selected locker "${selectedLockerName}".`);
        return;
      }
    }
    if (bag.iscompany === 0) {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bag.rfbag));
      const custCode = allBagFull?.istoreCust_Customercode || '';
      const jobCodes = new Set((scannedJobList || []).map((j) => norm(j.ccode)));
      if (custCode && !jobCodes.has(norm(custCode))) {
        setError(`Bag "${bag.rfbag}" belongs to "${allBagFull?.istoreCust_CustName || 'another customer'}" — not allowed for these jobs.`);
        return;
      }
    }
    const row = pendingRows.find((r) => bagMatchesRow(bag, r));
    if (!row) {
      setError(`No pending material in this job matches bag "${bag.rfbag}" — check item / shape / quality / color / size.`);
      return;
    }
    onAssign(jobId, row.rowKey, bag);
    setInfo(`Bag "${bag.rfbag}" assigned to ${row.MaterialTypeName || matLabel(row.item, isSolitaire(row))} · ${row.shape} · ${row.quality} · ${row.color}.`);
    setVal('');
  };

  const check = () => {
    const t = val.trim();
    if (!t) return;
    setError('');
    setInfo('');
    const bag = lookupBag(t);
    if (!bag) { setError(`Bag "${t}" not found in system.`); return; }
    assignBagToMatchingRow(bag);
  };

  return (
    <div className="bse-modal-backdrop" onClick={onClose}>
      <div className="bse-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bse-modal__close" onClick={onClose}><X size={15} /></button>
        <div className="bse-modal__icon"><ScanLine size={24} /></div>
        <h3>Add Other Bag</h3>
        <p>Scan a bag barcode, or pick one below — it auto-assigns to the pending row whose item / shape / quality / color / size matches.</p>
        <div className="bse-modal__row">
          <input
            ref={ref}
            className="bse-modal__input"
            placeholder="e.g. 0000000048"
            value={val}
            onChange={(e) => { setVal(e.target.value); setError(''); setInfo(''); }}
            onKeyDown={(e) => e.key === 'Enter' && check()}
          />
          <button className="bse-modal__check-btn" onClick={check}>Assign</button>
        </div>
        {error && <div className="bse-modal__error"><AlertCircle size={12} />{error}</div>}
        {info && (
          <div className="bse-modal__found" style={{ alignItems: 'center' }}>
            <CheckCircle2 size={12} />
            <div><span>{info}</span></div>
          </div>
        )}

        <div className="bse-modal__bag-list-head">
          <span>Scanned Bags</span>
          <span className="bse-row-count">{availableScannedBags.length}</span>
        </div>
        <div className="bse-modal__bag-list">
          {availableScannedBags.length === 0 ? (
            <div className="bse-modal__bag-empty">No unassigned scanned bags available.</div>
          ) : (
            availableScannedBags.map((b, i) => (
              <button
                key={`${b.rfbag}_${i}`}
                type="button"
                className="bse-modal__bag-item"
                onClick={() => assignBagToMatchingRow({
                  rfbag: b.rfbag, itemid: b.itemid, shape: b.shape,
                  quality: b.quality, size: b.size, color_name: b.color_name,
                  findingtypename: b.findingtypename || '', findingAccessories: b.findingAccessories || '',
                  pcs: b.rempcs ?? b.pcs ?? Number(b.scannedPcs ?? 0),
                  wt: b.remwt ?? b.wt ?? Number(b.scannedCwt ?? 0),
                  iscompany: b.iscompany,
                })}
                style={{ '--ic': matColor(b.item || b.type || '', isSolitaire(b)) }}
              >
                <span className="bse-modal__bag-no">{b.rfbag}</span>
                <span className="bse-modal__bag-spec">
                  {b.shape} · {b.quality} · {b.color_name} · {b.size}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Single table row ─────────────────────────────────────────────────────────
const MatRow = ({ sr, row, inputVals, locked, inputErrors, engagedLocked, onInput, onReturnRow, engagedUnlocked, remainingCwt }) => {
  const bag = row.matchedBag || row.manualBag;
  const isAuto = !!row.matchedBag;
  const color = matColor(row.item, isSolitaire(row));
  const isEngaged = engagedLocked?.has(row.rowKey) && !!bag;
  const isUnlocked = engagedUnlocked?.has(row.rowKey);
  const noBagBlocked = !bag && row.requiredBagNotScanned;
  const isExhausted = !isEngaged && !isUnlocked && bag && (bag.pcs ?? 0) <= 0 && (Number(bag.wt) ?? 0) <= 0;
  const pcsErr = inputErrors?.[`${row.rowKey}-pcs`];
  const cwtErr = inputErrors?.[`${row.rowKey}-cwt`];

  // Render entry cell content
  const renderPcs = () => {
    if (noBagBlocked) return <span className="bse-exhausted-cell">Bag not scanned</span>;
    if (isEngaged && !isUnlocked) return <span className="bse-engaged-val">{inputVals?.pcs ?? '—'}</span>;
    // locked state only for non-engaged rows that are saved — but still show input
    // Remove the locked check entirely — auto-save should never lock normal rows
    if (isExhausted) return <span className="bse-exhausted-cell">Scan other bag</span>;
    if (!bag) return <span className="bse-chip bse-chip--none">No bag</span>;
    return (
      <div className="bse-entry-cell">
        <input type="number"
          className={`bse-inp ${pcsErr ? 'bse-inp--error' : ''}`}
          placeholder={String(row.reqPcs)}
          value={inputVals?.pcs ?? ''}
          onChange={(e) => onInput(row.rowKey, 'pcs', e.target.value)} />
        <span className={`bse-avl-hint ${pcsErr ? 'bse-avl-hint--error' : ''}`}>
          {pcsErr ? `Max ${bag.pcs}` : `Avl: ${bag.pcs}`}
        </span>
      </div>
    );
  };

  const renderCwt = () => {
    if (noBagBlocked) return <span className="bse-exhausted-cell">Bag not scanned</span>;
    if (isEngaged && !isUnlocked) return (
      <div className="bse-entry-cell" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span className="bse-engaged-val">{inputVals?.cwt ?? '—'}</span>
        <button className="bse-return-btn" onClick={() => onReturnRow?.(row.rowKey)}>
          <RotateCcw size={9} /> Return
        </button>
      </div>
    );
    // Remove locked check — always show editable input for non-engaged rows
    if (isExhausted) return <span className="bse-exhausted-cell">0 stock</span>;
    if (!bag) return <span className="bse-muted">—</span>;
    return (
      <div className="bse-entry-cell">
        <input type="number" step="0.001"
          className={`bse-inp ${cwtErr ? 'bse-inp--error' : ''}`}
          placeholder={Number(row.reqWt).toFixed(3)}
          value={inputVals?.cwt ?? ''}
          onChange={(e) => onInput(row.rowKey, 'cwt', e.target.value)} />
        <span className={`bse-avl-hint ${cwtErr ? 'bse-avl-hint--error' : ''}`}>
          {(() => {
            const rem = remainingCwt ?? Number(bag.wt);
            return cwtErr ? `Max ${Number(rem).toFixed(3)}` : `Avl: ${Number(rem).toFixed(3)}`;
          })()}
        </span>
      </div>
    );
  };

  return (
    <tr className={[
      'bse-tr',
      bag ? 'bse-tr--bag' : 'bse-tr--nobag',
      noBagBlocked ? 'bse-tr--not-scanned' : '',
      isUnlocked ? 'bse-tr--unlocked' : '',
    ].filter(Boolean).join(' ')}>
      <td className="bse-td bse-td--sr">{sr}</td>
      <td className="bse-td bse-td--mat">
        <span className="bse-mat" style={{ color }}>{row.MaterialTypeName || matLabel(row.item, isSolitaire(row))}</span>
      </td>
      <td className="bse-td bse-td--desc">
        {row.shape} · {row.quality} · {row.color}{row.size ? ` · ${row.size}` : ''}
        {row.requiredBagNotScanned && !bag && (
          <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>
            <AlertCircle size={10} style={{ verticalAlign: 'middle' }} /> Required: {row.requiredBagRfbag}
          </div>
        )}
      </td>
      <td className="bse-td bse-td--bag">
        {bag ? (
          <span
            className={`bse-chip bse-chip--${isAuto ? bag.iscompany == 1 ? 'autocomp' : 'autoccust' : 'manual'}`}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <span>{bag.rfbag}</span>
            <span className={`bse-owner-badge ${bag.iscompany == 1 ? 'bse-owner-badge--company' : 'bse-owner-badge--customer'}`}>
              {bag.iscompany == 1 ? 'Company' : 'Customer'}
            </span>
          </span>
        ) : <span className="bse-chip bse-chip--none">No bag</span>}
      </td>
      <td className="bse-td bse-td--num">{row.reqPcs}</td>
      <td className="bse-td bse-td--num">{Number(row.reqWt).toFixed(3)}</td>
      <td className="bse-td bse-td--entry">{renderPcs()}</td>
      <td className="bse-td bse-td--entry">{renderCwt()}</td>
    </tr>
  );
};

// ─── Job Block ────────────────────────────────────────────────────────────────
const JobBlock = ({
  job, rows, onInput, inputs, saved, onSave, onReturn,
  inputErrors, engagedLocked, onReturnRow, engagedUnlocked,
  open, onToggle, onOpenAddBag, remainingCwtByRow,
}) => {


  // header summary pills
  const groups = {};
  rows.forEach((r) => {
    const k = isSolitaire(r) ? 'DIAMOND:S' : (r.item || 'Other');
    if (!groups[k]) groups[k] = { pcs: 0, wt: 0 };
    groups[k].pcs += r.reqPcs || 0;
    groups[k].wt += r.reqWt || 0;
  });

  const sortedRows = useMemo(() => {
    const specKey = (r) =>
      r.itemid === 5
        ? `${r.itemid}|${norm(r.findingtypename)}|${norm(r.findingAccessories)}`
        : `${r.itemid}|${norm(r.shape)}|${norm(r.quality)}|${norm(r.color)}|${norm(r.size)}`;

    // ANY row that has a bag (engaged, unlocked, or manual)
    const specWithAnyBag = new Set(
      rows
        .filter((r) => r.matchedBag || r.manualBag)
        .map(specKey)
    );

    return rows
      .filter((r) => {
        const bag = r.matchedBag || r.manualBag;
        if (bag) return true; // always show rows that have a bag
        // No-bag row: hide if another row with a bag exists for same spec
        return !specWithAnyBag.has(specKey(r));
      })
      .map((r, idx) => ({ ...r, __idx: idx }))
      .sort((a, b) => {
        const typeCompare = itemSortKey(a) - itemSortKey(b);
        if (typeCompare !== 0) return typeCompare;
        const aEngaged = engagedLocked?.has(a.rowKey) && (a.matchedBag || a.manualBag) ? 1 : 0;
        const bEngaged = engagedLocked?.has(b.rowKey) && (b.matchedBag || b.manualBag) ? 1 : 0;
        if (aEngaged !== bEngaged) return aEngaged - bEngaged;
        return a.__idx - b.__idx;
      });
  }, [rows, engagedLocked]);

  const assignedCount = sortedRows?.filter((r) => r.matchedBag || r.manualBag).length;
  const allDone = assignedCount === sortedRows?.length;
  const pendingCount = sortedRows?.length - assignedCount;

  return (
    <div className={`bse-job ${saved ? 'bse-job--saved' : ''}`}>
      {/* Header */}
      <div className="bse-job-hdr" onClick={onToggle}>
        <span className="bse-chevron">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="bse-job-id">{job.id}</span>
        <div className="bse-pills">
          {Object.entries(groups).map(([item, v]) => (
            <span key={item} className="bse-pill" style={{ '--pc': matColor(item) }}>
              <b>{matLabel(item)}</b>{v.wt.toFixed(3)} ctw · {v.pcs} pcs
            </span>
          ))}
        </div>
        <div className="bse-job-hdr__right">
          {!saved && pendingCount > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={12} />}
              className="bse-add-other-btn"
              onClick={(e) => { e.stopPropagation(); onOpenAddBag(job.id); }}
            >
              Add Other Bag
            </Button>
          )}
          <span className={`bse-badge ${allDone ? 'bse-badge--ok' : ''}`}>
            {assignedCount}/{rows.length} bags
          </span>
          {saved && <CheckCircle2 size={14} className="bse-check-icon" />}
        </div>
      </div>

      {/* Table */}
      {open && (
        <div className="bse-table-wrap">
          <table className="bse-table">
            <thead>
              <tr className="bse-thead-main">
                <th rowSpan={2} className="bse-th bse-th--sr">Sr</th>
                <th rowSpan={2} className="bse-th bse-th--mat">Material</th>
                <th rowSpan={2} className="bse-th bse-th--desc">Spec</th>
                <th rowSpan={2} className="bse-th bse-th--bag">Bag No</th>
                <th className="bse-th bse-th--sub">Req. PCS</th>
                <th className="bse-th bse-th--sub">Req. CTW / Gms</th>
                <th className="bse-th bse-th--sub bse-th--entry">Entry PCS</th>
                <th className="bse-th bse-th--sub bse-th--entry">Entry CWT</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => (
                <MatRow
                  key={row.rowKey}
                  sr={idx + 1}
                  row={row}
                  onInput={(rowKey, field, val) => {
                    if (engagedLocked?.has(rowKey) && !engagedUnlocked?.has(rowKey)) return;
                    onInput(rowKey, field, val);
                  }}
                  inputVals={inputs[row.rowKey]}
                  locked={saved}
                  inputErrors={inputErrors}
                  engagedLocked={engagedLocked}
                  onReturnRow={onReturnRow}
                  engagedUnlocked={engagedUnlocked}
                  remainingCwt={remainingCwtByRow?.[row.rowKey]}
                />
              ))}
            </tbody>
          </table>

          <div className="bse-save-row">
            {/* {!saved ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<Save size={12} />}
                className="bse-save-btn"
                onClick={() => onSave(job.id)}
              >
                Save Job {job.id}
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                startIcon={<RotateCcw size={12} />}
                className="bse-return-btn"
                onClick={() => onReturn(job.id)}
              >
                Return / Edit
              </Button>
            )} */}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Return / Edit Modal ─────────────────────────────────────────────────────
const ReturnModal = ({ jobId, rows, inputs, onSave, onUnlock, onClose }) => {
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
    <div className="bse-modal-backdrop" onClick={onClose}>
      <div className="bse-return-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bse-modal__close" onClick={onClose}><X size={15} /></button>
        <h3><RotateCcw size={16} /> Return / Edit — Job {jobId}</h3>
        <p>Review and edit the engaged entries for this job.</p>
        <div className="bse-return-modal__table-wrap">
          <table className="bse-table">
            <thead>
              <tr>
                <th className="bse-th bse-th--sr">Sr</th>
                <th className="bse-th bse-th--mat">Material</th>
                <th className="bse-th bse-th--desc">Spec</th>
                <th className="bse-th bse-th--bag">Bag</th>
                <th className="bse-th bse-th--sub bse-th--entry">PCS</th>
                <th className="bse-th bse-th--sub bse-th--entry">CWT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const bag = row.matchedBag || row.manualBag;
                return (
                  <tr key={row.rowKey} className="bse-tr">
                    <td className="bse-td bse-td--sr">{idx + 1}</td>
                    <td className="bse-td bse-td--mat">
                      <span className="bse-mat" style={{ color: matColor(row.item, isSolitaire(row)) }}>
                        {matIcon(row.item, isSolitaire(row))}{matLabel(row.item, isSolitaire(row))}
                      </span>
                    </td>
                    <td className="bse-td bse-td--desc">
                      {row.shape} · {row.quality} · {row.color}
                    </td>
                    <td className="bse-td bse-td--bag">
                      {bag ? (
                        <span>
                          {bag.rfbag}{' '}
                          <span
                            className={`bse-owner-badge ${bag.iscompany == 1 ? 'bse-owner-badge--company' : 'bse-owner-badge--customer'}`}
                          >
                            {bag.iscompany == 1 ? 'Company' : 'Customer'}
                          </span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="bse-td bse-td--entry">
                      <input type="number" className="bse-inp"
                        value={localInputs[row.rowKey]?.pcs ?? ''}
                        onChange={(e) => handleChange(row.rowKey, 'pcs', e.target.value)} />
                    </td>
                    <td className="bse-td bse-td--entry">
                      <input type="number" step="0.001" className="bse-inp"
                        value={localInputs[row.rowKey]?.cwt ?? ''}
                        onChange={(e) => handleChange(row.rowKey, 'cwt', e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bse-return-modal__actions">
          <Button variant="contained" size="small" startIcon={<Save size={12} />}
            onClick={() => onSave(jobId, localInputs)}>
            Re-engage
          </Button>
          <Button variant="outlined" size="small" startIcon={<Pencil size={12} />}
            onClick={() => onUnlock(jobId)}>
            Unlock Inline
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────
const BulkSingleEntry = ({ state, actions, onRegisterContinue }) => {
  const [sessionData] = useState(() => ({
    ScannedMaterials: getSession('scannedJobMaterialData'),
    ScannedBags: getSession('scannedBagData'),
    AllBagListData: getSession('allBagListData'),
    AllEngagedMaterial: getSession('allEngagedMaterial'),
    ScannedJobList: getSession('scannedJobListData'),
  }));
  const { ScannedMaterials, ScannedBags, AllBagListData, AllEngagedMaterial, ScannedJobList } = sessionData;
  // Temp debug — remove after fix
  console.log('ScannedBags:', ScannedBags);
  console.log('state.scannedBags:', state.scannedBags);
  console.log('state.requiredBags:', state.requiredBags);

  const jobs = state?.scannedJobs?.length > 0 ? state.scannedJobs : [];

  const [initData] = useState(() => {
    const map = {};
    const inputsInit = {};
    const engagedLockedInit = new Set();
    const matType = state?.materialType || 'all';
    jobs.forEach((j) => {
      const existing = state.jobEntries?.[j.id];
      const hasRealEngaged = existing?.bags?.some(b => b.txnid && b.txnid !== '0' && b.txnid !== 'null');
      if (existing?.bags?.length > 0 && hasRealEngaged) {
        map[j.id] = existing.bags.map(bag => ({
          rowKey: bag.rowKey || `${norm(j.id)}||${bag.qid}`,
          qid: bag.qid, jid: bag.jid,
          item: bag.item || '', itemid: bag.itemid || 0,
          is_sol_gem: bag.is_sol_gem || 0,
          stone_uniqueno: bag.stone_uniqueno || '',
          MaterialTypeName: bag.MaterialTypeName || '',
          shape: bag.shape || '', quality: bag.quality || '',
          color: bag.color || '', size: bag.size || '',
          reqPcs: bag.requiredPcs ?? 0, reqWt: bag.requiredWt ?? 0,
          isUnusedBag: bag.isUnusedBag || false,
          requiredBagNotScanned: false, requiredBagRfbag: null,
          matchedBag: bag.rfbag ? (() => {
            const live = ScannedBags.find(b => norm(b.rfbag) === norm(bag.rfbag)) ||
              AllBagListData?.find(b => norm(b.rfbag) === norm(bag.rfbag));
            return {
              rfbag: bag.rfbag,
              pcs: live ? (live.rempcs ?? live.pcs ?? Number(live.scannedPcs ?? 0)) : 0,
              wt: live ? (live.remwt ?? live.wt ?? Number(live.scannedCwt ?? 0)) : 0,
              iscompany: bag.iscompany,
            };
          })() : null,
          manualBag: null,
          txnid: bag.txnid ?? null,
        }));
        existing.bags.forEach(bag => {
          if (bag.rowKey) {
            inputsInit[bag.rowKey] = { pcs: String(bag.pcs ?? ''), cwt: String(bag.wt ?? '') };
            // Only lock if truly engaged (has txnid from SP) — not just auto-filled
            if (bag.rfbag && bag.txnid && bag.txnid !== '0' && bag.txnid !== 'null') {
              engagedLockedInit.add(bag.rowKey);
            }
          }
        });
      } else {
        const rows = buildJobRows(j.id, ScannedMaterials, ScannedBags, matType, state.requiredBags ?? [], state.scannedBags ?? []);
        rows.forEach(row => {
          if (!row.matchedBag) return;
          const engaged = getEngagedTotals(AllEngagedMaterial, j.id, row);
          if (engaged) {
            inputsInit[row.rowKey] = { pcs: String(engaged.pcs), cwt: engaged.wt.toFixed(3) };
            // Only lock if truly engaged — txnid must exist
            if (engaged.txnid && engaged.txnid !== '0') {
              engagedLockedInit.add(row.rowKey);
              row.txnid = engaged.txnid;
            } else {
              row.txnid = null;
            }
          } else {
            inputsInit[row.rowKey] = {
              pcs: String(row.reqPcs ?? ''),
              cwt: Number(row.reqWt ?? 0).toFixed(3),
            };
          }
        });

        // Extra engaged rows: allEngagedMaterial for this job, grouped by rfbag+material, excluding already-matched bags
        const allowedItemIds = MATERIAL_ITEMID_MAP[matType] ?? null;
        const egMap = {};
        (AllEngagedMaterial || []).forEach(e => {
          if (!e.isengage) return;
          if (norm(e.serialjobno) !== norm(j.id)) return;
          if (!materialTypeFilter(e, matType)) return;
          const key = [norm(e.rfbag), e.itemid, norm(e.shape || ''), norm(e.Quality || ''), norm(e.color || ''), norm(e.Size || ''), norm(e.findingtypename || ''), norm(e.findingAccessories || '')].join('|');
          if (!egMap[key]) egMap[key] = { ...e, totalPcs: 0, totalWt: 0, txnids: new Set() };
          egMap[key].totalPcs += Number(e.isspcs || 0);
          egMap[key].totalWt += Number(e.isswt || 0);
          if (e.txnid !== undefined && e.txnid !== null && e.txnid !== '') {
            egMap[key].txnids.add(e.txnid);
          }
        });
        const extraRows = Object.values(egMap)
          .filter(e => !rows.some(line => {
            if (!line.matchedBag || norm(line.matchedBag.rfbag) !== norm(e.rfbag)) return false;
            if (e.itemid !== line.itemid) return false;
            if (line.itemid === 5) {
              return norm(e.findingtypename || '') === norm(line.findingtypename || '') &&
                norm(e.findingAccessories || '') === norm(line.findingAccessories || '');
            }
            return norm(e.shape || '') === norm(line.shape || '') &&
              norm(e.Quality || '') === norm(line.quality || '') &&
              norm(e.color || '') === norm(line.color || '');
          }))
          .map((e, idx) => {
            const rawBag = AllBagListData.find(b => norm(b.rfbag) === norm(e.rfbag)) ||
              ScannedBags.find(b => norm(b.rfbag) === norm(e.rfbag));
            const bagPcs = rawBag ? (rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0)) : 0;
            const bagWt = rawBag ? (rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0)) : 0;
            const iscompany = rawBag ? rawBag.iscompany : undefined;
            const rowKey = `extra-${norm(e.rfbag)}-${e.itemid}-${idx}`;
            const eIsSol = isSolitaire(e);
            const itemName = eIsSol ? 'DIAMOND:S' : (e.itemid === 3 ? 'DIAMOND' : e.itemid === 4 ? 'COLORSTONE' : e.itemid === 5 ? 'FINDING' : 'MISC');
            inputsInit[rowKey] = { pcs: String(e.totalPcs), cwt: e.totalWt.toFixed(3) };
            engagedLockedInit.add(rowKey);
            const txnidList = [...e.txnids];
            return {
              rowKey, qid: e.qid ?? null, jid: e.jid ?? null,
              item: itemName, itemid: e.itemid,
              is_sol_gem: e.is_sol_gem || 0,
              stone_uniqueno: e.stone_uniqueno || '',
              MaterialTypeName: null,
              shape: e.shape || '', quality: e.Quality || '', color: e.color || '', size: e.Size || '',
              findingtypename: e.findingtypename || '', findingAccessories: e.findingAccessories || '',
              reqPcs: e.totalPcs, reqWt: e.totalWt,
              isUnusedBag: false, isExtraEngaged: true,
              requiredBagNotScanned: false, requiredBagRfbag: null,
              matchedBag: { rfbag: e.rfbag, pcs: bagPcs, wt: bagWt, iscompany },
              manualBag: null,
              txnid: txnidList.length ? txnidList.join(',') : null,
            };
          });

        map[j.id] = [...rows, ...extraRows];
      }
    });
    return { map, inputsInit, engagedLockedInit };
  });

  const [jobRows, setJobRows] = useState(initData.map);
  const [inputs, setInputs] = useState(initData.inputsInit);
  const [engagedLocked, setEngagedLocked] = useState(initData.engagedLockedInit);
  const [engagedUnlocked, setEngagedUnlocked] = useState(() => new Set());
  const [inputErrors, setInputErrors] = useState({});
  const [savedJobs, setSavedJobs] = useState(() => new Set(Object.keys(state.jobEntries ?? {})));
  const [addBagJobId, setAddBagJobId] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [autoFill, setAutoFill] = useState(true);

  // ── Expand / collapse all (header chevron toggle) ──
  const [openMap, setOpenMap] = useState(() => {
    const init = {};
    jobs.forEach(j => { init[j.id] = true; });
    return init;
  });
  const allOpen = jobs.length > 0 && jobs.every(j => openMap[j.id]);

  // Per-row remaining CWT for a shared bag: the bag's available weight minus
  // the weight already committed to that same bag on every other row/job.
  const remainingCwtByRow = useMemo(() => {
    const usedByBag = {};
    Object.values(jobRows).flat().forEach((r) => {
      const b = r.matchedBag || r.manualBag;
      if (!b) return;
      const rf = norm(b.rfbag);
      usedByBag[rf] = (usedByBag[rf] || 0) + (parseFloat(inputs[r.rowKey]?.cwt) || 0);
    });
    const map = {};
    Object.values(jobRows).flat().forEach((r) => {
      const b = r.matchedBag || r.manualBag;
      if (!b) return;
      const rf = norm(b.rfbag);
      const avail = Number(b.wt) || 0;
      const thisUsed = parseFloat(inputs[r.rowKey]?.cwt) || 0;
      map[r.rowKey] = avail - ((usedByBag[rf] || 0) - thisUsed);
    });
    return map;
  }, [jobRows, inputs]);

  // ── Auto Fill: mirror the Bulk-Material page. When ON, pre-fill Entry
  //    PCS/CWT with the Required amount for every bag-assigned row; when OFF,
  //    clear them. Engaged (locked) and returned-for-edit rows are never
  //    clobbered so committed data stays intact. ──
  useEffect(() => {
    setInputs((prev) => {
      const next = { ...prev };
      Object.values(jobRows).flat().forEach((r) => {
        if (engagedLocked.has(r.rowKey) || engagedUnlocked.has(r.rowKey)) return;
        const bag = r.matchedBag || r.manualBag;
        if (!bag) return;
        next[r.rowKey] = autoFill
          ? { pcs: String(r.reqPcs ?? ''), cwt: Number(r.reqWt ?? 0).toFixed(3) }
          : { pcs: '', cwt: '' };
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFill, jobRows]);

  const toggleJobOpen = (jobId) => setOpenMap(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  const toggleAllOpen = () => {
    const next = !allOpen;
    const updated = {};
    jobs.forEach(j => { updated[j.id] = next; });
    setOpenMap(updated);
  };

  const handleInput = (rowKey, field, val) => {
    setInputs((prev) => {
      const nextInputs = { ...prev, [rowKey]: { ...prev[rowKey], [field]: val } };
      const row = Object.values(jobRows).flat().find(r => r.rowKey === rowKey);
      const bag = row?.matchedBag || row?.manualBag;
      // Only CWT is capped: total weight pulled from a bag across ALL rows/jobs
      // shown here must not exceed the bag's available weight. PCS is not capped.
      if (bag && field === 'cwt') {
        const avail = Number(bag.wt) || 0;
        const target = norm(bag.rfbag);
        let otherUsed = 0;
        Object.values(jobRows).flat().forEach((r) => {
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

  // ── Job-wise "Add Other Bag" — auto-matches the bag to a pending row in the job ──
  const handleAssignToJob = (jobId, rowKey, bag) => {
    setJobRows((prev) => ({
      ...prev,
      [jobId]: prev[jobId].map((r) =>
        r.rowKey === rowKey ? { ...r, manualBag: bag, isUnusedBag: true, requiredBagNotScanned: false } : r
      ),
    }));
    setInputs((prev) => {
      if (prev[rowKey]?.pcs || prev[rowKey]?.cwt) return prev; // don't clobber existing entry
      const row = jobRows[jobId]?.find((r) => r.rowKey === rowKey);
      return {
        ...prev,
        [rowKey]: {
          pcs: String(row?.reqPcs ?? ''),
          cwt: Number(row?.reqWt ?? 0).toFixed(3),
        },
      };
    });
  };

  // ── Save ALL jobs at once (called by Continue to Summary) ──
  const handleSaveAll = () => {
    jobs.forEach((j) => {
      const rows = jobRows[j.id] || [];
      const entries = rows.map((r) => {
        const bag = r.matchedBag || r.manualBag;
        return {
          rowKey: r.rowKey, qid: r.qid, jid: r.jid, isUnusedBag: r.isUnusedBag,
          item: r.item, itemid: r.itemid,
          is_sol_gem: r.is_sol_gem || 0,
          stone_uniqueno: r.stone_uniqueno || '',
          MaterialTypeName: r.MaterialTypeName,
          shape: r.shape, quality: r.quality, color: r.color, size: r.size,
          findingtypename: r.findingtypename || '', findingAccessories: r.findingAccessories || '',
          requiredPcs: r.reqPcs, requiredWt: r.reqWt,
          rfbag: bag?.rfbag || null,
          bag: bag ? { rfbag: bag.rfbag } : null,
          iscompany: bag?.iscompany ?? null,
          txnid: r.txnid ?? null,
          pcs: parseFloat(inputs[r.rowKey]?.pcs) || 0,
          wt: parseFloat(inputs[r.rowKey]?.cwt) || 0,
        };
      });
      actions?.updateJobEntry?.(j.id, { bags: entries });
    });
    setSavedJobs(new Set(jobs.map(j => j.id)));
  };

  // Register with parent so "Continue to Summary" triggers save
  const saveRef = useRef(handleSaveAll);
  saveRef.current = handleSaveAll;
  useEffect(() => {
    if (onRegisterContinue) {
      onRegisterContinue(() => saveRef.current());
      return () => onRegisterContinue(null);
    }
  }, [onRegisterContinue]);

  // Auto-save debounced on any input/row change
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    const t = setTimeout(() => saveRef.current(), 400);
    return () => clearTimeout(t);
  }, [inputs, jobRows]);

  const handleSave = (jobId) => {
    const rows = jobRows[jobId] || [];
    if (rows.some(r => inputErrors[`${r.rowKey}-pcs`] || inputErrors[`${r.rowKey}-cwt`])) return;
    if (rows.some(r => {
      const b = r.matchedBag || r.manualBag;
      return b && !engagedLocked.has(r.rowKey) && !(parseFloat(inputs[r.rowKey]?.cwt) > 0);
    })) return;
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, qid: r.qid, jid: r.jid, isUnusedBag: r.isUnusedBag,
        item: r.item, itemid: r.itemid,
        is_sol_gem: r.is_sol_gem || 0,
        stone_uniqueno: r.stone_uniqueno || '',
        MaterialTypeName: r.MaterialTypeName,
        shape: r.shape, quality: r.quality, color: r.color, size: r.size,
        findingtypename: r.findingtypename || '', findingAccessories: r.findingAccessories || '',
        requiredPcs: r.reqPcs, requiredWt: r.reqWt,
        rfbag: bag?.rfbag || null,
        bag: bag ? { rfbag: bag.rfbag } : null,
        iscompany: bag?.iscompany ?? null,
        txnid: r.txnid ?? null,
        pcs: parseFloat(inputs[r.rowKey]?.pcs) || 0,
        wt: parseFloat(inputs[r.rowKey]?.cwt) || 0,
      };
    });
    actions?.updateJobEntry?.(jobId, { bags: entries });
    setSavedJobs((prev) => new Set([...prev, jobId]));
  };

  const handleReturn = (jobId) => setReturnModal(jobId);

  const handleReturnSave = (jobId, updatedInputs) => {
    setInputs((prev) => ({ ...prev, ...updatedInputs }));
    const rows = jobRows[jobId] || [];
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, qid: r.qid, jid: r.jid, isUnusedBag: r.isUnusedBag,
        item: r.item, itemid: r.itemid,
        is_sol_gem: r.is_sol_gem || 0,
        stone_uniqueno: r.stone_uniqueno || '',
        rfbag: bag?.rfbag || null,
        shape: r.shape, quality: r.quality, color: r.color, size: r.size,
        findingtypename: r.findingtypename || '', findingAccessories: r.findingAccessories || '',
        bag: bag ? { rfbag: bag.rfbag } : null,
        iscompany: bag?.iscompany ?? null,
        txnid: r.txnid ?? null,
        pcs: parseFloat(updatedInputs[r.rowKey]?.pcs) || 0,
        wt: parseFloat(updatedInputs[r.rowKey]?.cwt) || 0,
      };
    });
    actions?.updateJobEntry?.(jobId, { bags: entries });
    setReturnModal(null);
  };

  const handleReturnUnlock = (jobId) => {
    setSavedJobs((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    setReturnModal(null);
  };

  const handleReturnRow = (rowKey) => {
    setEngagedLocked((prev) => { const next = new Set(prev); next.delete(rowKey); return next; });
    setEngagedUnlocked((prev) => { const next = new Set(prev); next.add(rowKey); return next; });
  };

  const total = jobs.length;
  const saved = savedJobs.size;

  return (
    <div className="bse-layout">
      <div className="bse-root">
        {/* Top progress */}
        <div className="bse-topbar">
          {jobs.length > 0 && (
            <button
              type="button"
              className="bse-expand-all-btn"
              onClick={toggleAllOpen}
              title={allOpen ? 'Collapse all jobs' : 'Expand all jobs'}
            >
              {allOpen ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
              {/* <span>{allOpen ? 'Collapse All' : 'Expand All'}</span> */}
            </button>
          )}

          <div className="bse-topbar__left">
            <span className="bse-topbar__title">Bulk → Single · Material Entry</span>
            <span className="bse-topbar__sub">{saved} / {total} jobs saved</span>
          </div>
          <div className="bse-topbar__track">
            <div className="bse-topbar__fill" style={{ width: `${total ? (saved / total) * 100 : 0}%` }} />
          </div>

          <FormControlLabel
            className="bse-topbar__autofill"
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

        {/* Jobs */}
        <div className="bse-scroll">
          {jobs.map((job) => {
            const rows = jobRows[job.id] || [];
            if (rows.length === 0)
              return (
                <div key={job.id} className="bse-empty-job">
                  <Info size={13} />
                  <span>Job <strong>{job.id}</strong> — no material lines found in system data.</span>
                </div>
              );
            return (
              <JobBlock
                key={job.id}
                job={job}
                rows={rows}
                onInput={handleInput}
                inputs={inputs}
                saved={savedJobs.has(job.id)}
                onSave={handleSave}
                onReturn={handleReturn}
                inputErrors={inputErrors}
                remainingCwtByRow={remainingCwtByRow}
                engagedLocked={engagedLocked}
                onReturnRow={handleReturnRow}
                engagedUnlocked={engagedUnlocked}
                open={!!openMap[job.id]}
                onToggle={() => toggleJobOpen(job.id)}
                onOpenAddBag={(jobId) => setAddBagJobId(jobId)}
              />
            );
          })}
        </div>

        {addBagJobId && (
          <AddOtherBagModal
            jobId={addBagJobId}
            rows={jobRows[addBagJobId] || []}
            onAssign={handleAssignToJob}
            onClose={() => setAddBagJobId(null)}
            scannedBags={ScannedBags}
            AllBagListData={AllBagListData}
            scannedJobList={ScannedJobList}
            selectedLockerName={state.locker?.name || ''}
          />
        )}

        {returnModal && (
          <ReturnModal
            jobId={returnModal}
            rows={jobRows[returnModal] || []}
            inputs={inputs}
            onSave={handleReturnSave}
            onUnlock={handleReturnUnlock}
            onClose={() => setReturnModal(null)}
          />
        )}
      </div>

      {/* ── Saved jobs sidebar ── */}
      {saved > 0 && (
        <div className="bse-sidebar">
          <div className="bse-sidebar__title"><CheckCircle2 size={14} /> Jobs Detail</div>
          {jobs.map(j => {
            const allRows = jobRows[j.id] || [];
            const isSaved = savedJobs.has(j.id);

            // Same filter as sortedRows — hide no-bag ghost rows
            const specKey = (r) =>
              r.itemid === 5
                ? `${r.itemid}|${norm(r.findingtypename)}|${norm(r.findingAccessories)}`
                : `${r.itemid}|${norm(r.shape)}|${norm(r.quality)}|${norm(r.color)}|${norm(r.size)}`;
            const specWithAnyBag = new Set(
              allRows.filter(r => r.matchedBag || r.manualBag).map(specKey)
            );
            const sidebarRows = allRows.filter(r => {
              const bag = r.matchedBag || r.manualBag;
              if (bag) return true;
              return !specWithAnyBag.has(specKey(r));
            });

            return (
              <div key={j.id} className={`bse-sidebar__job ${isSaved ? 'bse-sidebar__job--saved' : ''}`}>
                <div className="bse-sidebar__job-head">
                  <strong>{j.id}</strong>
                  <span className="bse-sidebar__meta">
                    {isSaved && <CheckCircle2 size={10} style={{ color: '#16a34a', marginRight: 3 }} />}
                    {sidebarRows.length} rows
                  </span>
                </div>
                <div className="bse-sidebar__chips">
                  {sidebarRows.map(r => {
                    const bag = r.matchedBag || r.manualBag;
                    return (
                      <div key={r.rowKey} className={`bse-sidebar__chip ${!bag ? 'bse-sidebar__chip--warn' : ''}`}>
                        <span className="bse-sidebar__spec">{r.shape} · {r.quality} · {r.color}</span>
                        {bag
                          ? <span className="bse-sidebar__bag">{bag.rfbag}</span>
                          : <span className="bse-sidebar__nobag">No bag</span>
                        }
                        <span className="bse-sidebar__vals">
                          {inputs[r.rowKey]?.pcs || '—'} / {inputs[r.rowKey]?.cwt || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BulkSingleEntry;