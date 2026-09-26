import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, ChevronsDown, ChevronsUp, ScanLine,
  Package, Gem, Palette, Wrench, Stone,
  CheckCircle2, Save, Plus, AlertCircle, X, Info, Pencil, RotateCcw,
} from 'lucide-react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import ScannerInput from '../../../components/ScannerInput/ScannerInput';
import { useGlobalScanner } from '../../../hooks/useGlobalScanner';
import './Bulksingleentry.scss';
import { getMaster, isMasterKey } from '../../../Utils/masterStore';
import { getJobInfo, getRemainingBagStock } from '../../../Utils/globalFunc';
import { materialTypeItemIds } from '../../../Utils/materialTypes';


// ─── Utilities ────────────────────────────────────────────────────────────────
const getSession = (key) => { if (isMasterKey(key)) return getMaster(key, []); try { const r = sessionStorage.getItem(key); return r ? JSON.parse(r) : []; } catch { return []; } };
const norm = (s) => String(s ?? '').trim().toUpperCase();

const allocateFill = (allRows, { skip, preUsed }) => {
  const pool = {};
  const poolOf = (bag) => {
    const rf = norm(bag.rfbag);
    if (!pool[rf]) pool[rf] = { pcs: Number(bag.pcs) || 0, wt: Number(bag.wt) || 0 };
    return pool[rf];
  };
  allRows.forEach((r) => {
    const bag = r.matchedBag || r.manualBag;
    if (!bag) return;
    const p = poolOf(bag);
    const v = preUsed(r);
    if (!v) return;
    p.pcs -= parseFloat(v.pcs) || 0;
    p.wt -= parseFloat(v.cwt) || 0;
  });
  const out = {};
  allRows.forEach((r) => {
    const bag = r.matchedBag || r.manualBag;
    if (!bag || skip(r)) return;
    const p = poolOf(bag);
    const pcs = Math.max(0, Math.min(Number(r.reqPcs) || 0, p.pcs));
    const wt = Math.max(0, Math.min(Number(r.reqWt) || 0, p.wt));
    p.pcs -= pcs; p.wt -= wt;
    out[r.rowKey] = { pcs: String(pcs), cwt: wt.toFixed(3) };
  });
  return out;
};

const isCenterStone = (m) =>
  Number(m?.IsCenterStone ?? m?.iscenterstone ?? m?.is_sol_gem ?? 0) === 1;

const withCenterSuffix = (name, m) => {
  if (!isCenterStone(m)) return name;
  const u = String(name).toUpperCase();
  if (u.endsWith(':S') || u.endsWith(':G')) return name;
  const id = Number(m?.itemid);
  if (id === 3) return `${name}:S`;
  if (id === 4) return `${name}:G`;
  return name;
};

const getEngagedTotals = (AllEngagedMaterial, serialJobNo, row) => {
  const matches = (AllEngagedMaterial || []).filter(e => {
    if (!e.isengage) return false;
    if (norm(e.serialjobno) !== norm(serialJobNo)) return false;
    if (e.itemid !== row.itemid) return false;
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
  return { pcs, wt, txnid };
};

const findBagById = (id, pool) =>
  pool.find((b) => norm(b.rfbag) === norm(id) || norm(b.rfbag).endsWith(norm(id))) || null;

const bagMatchesRow = (bag, row) => {
  if (bag.itemid !== row.itemid) return false;
  if (row.itemid === 5) {
    return norm(bag.findingtypename || '') === norm(row.findingtypename || '') &&
      norm(bag.findingAccessories || '') === norm(row.findingAccessories || '');
  }
  return norm(bag.shape || '') === norm(row.shape || '') &&
    norm(bag.quality || '') === norm(row.quality || '') &&
    norm(bag.color_name || '') === norm(row.color || '') &&
    norm(bag.size || '') === norm(row.size || '');
};

const matColor = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return '#6343f1';
  if (u.includes('COLORSTONE:G')) return '#00897b';
  if (u.includes('DIAMOND')) return '#1565c0';
  if (u.includes('COLORSTONE')) return '#7b1fa2';
  if (u.includes('FINDING') || u.includes('MISC')) return '#e65100';
  return '#607d8b';
};

const matLabel = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return 'Diamond:S';
  if (u.includes('COLORSTONE:G')) return 'Colorstone:G';
  if (u.includes('DIAMOND')) return 'Diamond';
  if (u.includes('COLORSTONE')) return 'Colorstone';
  if (u.includes('FINDING')) return 'Finding';
  return item;
};

const materialTypeFilter = (m, materialType) => {
  const allowed = materialTypeItemIds(materialType);
  return !allowed || allowed.includes(Number(m.itemid));
};

const ITEM_ORDER = { 3: 1, 4: 3, 5: 5, 7: 6 };
const itemSortKey = (r) => {
  if (r.isOtherBag) return 999;   // ← NEW: "Other Bag" rows always sort to the end, regardless of itemid
  if (isCenterStone(r)) {
    if (Number(r.itemid) === 3) return 2;
    if (Number(r.itemid) === 4) return 4;
  }
  return ITEM_ORDER[r.itemid] ?? 99;
};

const buildJobRows = (serialJobNo, ScannedMaterials, ScannedBags, materialType = 'all', requiredBags = [], scannedBagsCtx = []) => {
  return ScannedMaterials
    .filter(m => norm(m.SerialJobNo) === norm(serialJobNo))
    .filter(m => materialTypeFilter(m, materialType))
    .map((m, idx) => {
      const mIsCS = isCenterStone(m);
      const sameJob = (b) => !b.SerialJobNo || norm(b.SerialJobNo) === norm(m.SerialJobNo);
      const bagPool = [...ScannedBags, ...scannedBagsCtx].filter((b, bagIdx, all) =>
        all.findIndex((candidate) =>
          norm(candidate.rfbag) === norm(b.rfbag) &&
          String(candidate.qid ?? '') === String(b.qid ?? '') &&
          String(candidate.jid ?? '') === String(b.jid ?? '') &&
          norm(candidate.SerialJobNo) === norm(b.SerialJobNo)
        ) === bagIdx
      );
      const lineRequiredBags = requiredBags.filter((rb) =>
        String(rb.qid ?? '') === String(m.qid ?? '') &&
        String(rb.jid ?? '') === String(m.jid ?? '') &&
        sameJob(rb)
      );
      const anyScanned = lineRequiredBags.some((rb) =>
        bagPool.some((b) => norm(b.rfbag) === norm(rb.rfbag) && sameJob(b))
      );
      const hasRequired = lineRequiredBags.length > 0;

      const byQidJid = (m.qid != null && m.jid != null)
        ? bagPool.find((b) =>
          String(b.qid) === String(m.qid) &&
          String(b.jid) === String(m.jid) &&
          sameJob(b)
        )
        : null;

      const scannedReqBag = lineRequiredBags
        .map((rb) => bagPool.find((b) =>
          norm(b.rfbag) === norm(rb.rfbag) && sameJob(b)
        ))
        .find(Boolean);

      const bySpec = bagPool.find((b) =>
        sameJob(b) &&
        Number(b.itemid) === Number(m.itemid) &&
        norm(b.shape || '') === norm(m.shape || '') &&
        norm(b.quality || b.Quality || '') === norm(m.Quality || '') &&
        norm(b.color_name || b.color || '') === norm(m.color || '') &&
        norm(b.size || b.Size || '') === norm(m.size || m.customsize || '') &&
        (!mIsCS || !m.stone_uniqueno || !b.stone_uniqueno ||
          norm(b.stone_uniqueno) === norm(m.stone_uniqueno))
      );

      const byRequiredRfbag = lineRequiredBags.length > 0
        ? bagPool.find((b) =>
          sameJob(b) && lineRequiredBags.some((rb) => norm(rb.rfbag) === norm(b.rfbag))
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
        item: withCenterSuffix(m.item || '', m),
        itemid: m.itemid,
        IsCenterStone: m.IsCenterStone ?? 0,
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

// ─── Job-wise Add Other Bag Modal ─────────────────────────────────────────────
const AddOtherBagModal = ({ jobId, rows, onAssign, onAddNew, onClose, scannedBags, AllBagListData, scannedJobList, selectedLockerName, jobEntries }) => {
  const [val, setVal] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const pendingRows = rows.filter((r) => !(r.matchedBag || r.manualBag));
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
    if (rows.some((row) => norm((row.matchedBag || row.manualBag)?.rfbag) === norm(bag.rfbag))) {
      setError(`Bag "${bag.rfbag}" is already added to this job.`);
      return;
    }

    const remaining = getRemainingBagStock(
      jobEntries,
      bag.rfbag,
      bag.pcs,
      bag.wt,
      jobId
    );
    if (remaining.pcs <= 0 || remaining.cwt <= 0) {
      setError(`Bag "${bag.rfbag}" is fully used. No PCS / CWT remains.`);
      return;
    }
    bag.pcs = remaining.pcs;
    bag.wt = remaining.cwt;

    {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bag.rfbag));
      const bagLockerName = (allBagFull?.LockerName || bag.LockerName || '').replace(/\s/g, '');
      const selLockerName = (selectedLockerName || '').replace(/\s/g, '');
      if (bagLockerName && selLockerName && bagLockerName !== selLockerName) {
        setError(`Bag "${bag.rfbag}" belongs to locker "${allBagFull?.LockerName}" — not allowed for selected locker "${selectedLockerName}".`);
        return;
      }
    }

    if ((bag.pcs ?? 0) <= 0 || (Number(bag.wt) ?? 0) <= 0) {
      setError(`Bag "${bag.rfbag}" has no stock available (${bag.pcs ?? 0} pcs / ${Number(bag.wt ?? 0).toFixed(3)} ctw) — cannot add.`);
      return;
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
      if (onAddNew) {
        onAddNew(jobId, bag);
        setInfo(`Bag "${bag.rfbag}" didn't match an existing line — added as a new material line for this job.`);
        setVal('');
        return;
      }
      setError(`No pending material in this job matches bag "${bag.rfbag}".`);
      return;
    }
    onAssign(jobId, row.rowKey, bag);
    setInfo(`Bag "${bag.rfbag}" assigned to ${row.MaterialTypeName || matLabel(row.item)} · ${row.shape} · ${row.quality} · ${row.color}.`);
    setVal('');
  };

  const check = (rawVal) => {
    const raw = typeof rawVal === 'string' ? rawVal : val;
    const t = raw.trim();
    if (!t) return;
    setVal(t);
    setError('');
    setInfo('');
    const bag = lookupBag(t);
    if (!bag) { setError(`Bag "${t}" not found in system.`); return; }
    assignBagToMatchingRow(bag);
  };
  useGlobalScanner(ref, check);

  return (
    <div className="bse-modal-backdrop" onClick={onClose}>
      <div className="bse-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bse-modal__close" onClick={onClose}><X size={15} /></button>
        <div className="bse-modal__icon"><ScanLine size={24} /></div>
        <h3>Add Other Bag</h3>
        <p>Scan a bag barcode, or pick one below — it auto-assigns to the pending row whose item / shape / quality / color / size matches.</p>
        <ScannerInput
          ref={ref}
          compact
          value={val}
          onChange={(e) => { setVal(e.target.value); setError(''); setInfo(''); }}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          onSubmit={check}
          placeholder="e.g. 0000000048"
          buttonLabel="Assign"
          error={error}
          autoFocus
        />
        {info && (
          <div className="bse-modal__found" style={{ alignItems: 'center' }}>
            <CheckCircle2 size={12} />
            <div><span>{info}</span></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Single table row ─────────────────────────────────────────────────────────
const MatRow = ({ sr, row, inputVals, locked, inputErrors, engagedLocked, onInput, onReturnRow, engagedUnlocked, remainingCwt }) => {
  const bag = row.matchedBag || row.manualBag;
  const isAuto = !!row.matchedBag;
  const color = matColor(row.item);
  const isEngaged = engagedLocked?.has(row.rowKey) && !!bag;
  const isUnlocked = engagedUnlocked?.has(row.rowKey);
  const noBagBlocked = !bag && row.requiredBagNotScanned;
  const isExhausted = !isEngaged && !isUnlocked && bag && (bag.pcs ?? 0) <= 0 && (Number(bag.wt) ?? 0) <= 0;
  const pcsErr = inputErrors?.[`${row.rowKey}-pcs`];
  const cwtErr = inputErrors?.[`${row.rowKey}-cwt`];

  const renderPcs = () => {
    if (noBagBlocked) return <span className="bse-exhausted-cell">Bag not scanned</span>;
    if (isEngaged && !isUnlocked) return <span className="bse-engaged-val">{inputVals?.pcs ?? '—'}</span>;
    if (isExhausted) return <span className="bse-exhausted-cell">Scan other bag</span>;
    if (!bag) return <span>—</span>;
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
    if (isExhausted) return <span className="bse-exhausted-cell">0 stock</span>;
    if (!bag) return <span>—</span>;
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
    ].filter(Boolean).join(' ')}
      style={{
        backgroundColor: row.isOtherBag && '#feeac6'
      }}>
      <td className="bse-td bse-td--sr">{sr}</td>
      <td className="bse-td bse-td--mat">
        <span className="bse-mat" style={{ color }}>{row.MaterialTypeName || matLabel(row.item)}</span>
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
        ) : <span className="bse-chip bse-chip--none">No Engage</span>}
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
  const groups = {};
  rows.forEach((r) => {
    const k = withCenterSuffix(r.item || 'Other', r);
    if (!groups[k]) groups[k] = { pcs: 0, wt: 0 };
    groups[k].pcs += r.reqPcs || 0;
    groups[k].wt += r.reqWt || 0;
  });

  const sortedRows = useMemo(() => {
    const specKey = (r) =>
      r.itemid === 5
        ? `${r.itemid}|${norm(r.findingtypename)}|${norm(r.findingAccessories)}`
        : `${r.itemid}|${norm(r.shape)}|${norm(r.quality)}|${norm(r.color)}|${norm(r.size)}`;

    const specWithAnyBag = new Set(
      rows
        .filter((r) => r.matchedBag || r.manualBag)
        .map(specKey)
    );

    return rows
      .filter((r) => {
        const bag = r.matchedBag || r.manualBag;
        if (bag) return true;
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

  const jobMeta = useMemo(
    () => getJobInfo(job.serialjobno ?? job.id, [job]),
    [job]
  );

  return (
    <div className={`bse-job ${saved ? 'bse-job--saved' : ''}`}>
      <div className="bse-job-hdr" onClick={onToggle}>
        <span className="bse-chevron">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="bse-job-id">{job.id}</span>
        <div className="bse-pills">
          <div>
            {Object.entries(groups).map(([item, v]) => (
              <span key={item} className="bse-pill" style={{ '--pc': matColor(item) }}>
                <b>{matLabel(item)}</b>{v.wt.toFixed(3)} ctw · {v.pcs} pcs
              </span>
            ))}
          </div>
          <div>
            <span className="bse-job-meta">
              <span>Design#: <strong>{jobMeta.design || '—'}</strong></span>
              <span>Serial for: <strong>{jobMeta.category || '—'}</strong></span>
              <span>Customer: <strong>{jobMeta.ccode || '—'}</strong></span>
              <span>Metal: <strong>{jobMeta.metal || '—'}</strong></span>
              <span>Color: <strong>{jobMeta.color || '—'}</strong></span>
              <span>Current Status: <strong>{jobMeta.status || '—'}</strong></span>
            </span>
          </div>
        </div>
        <div className="bse-job-hdr__right">
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={12} />}
            className="bse-add-other-btn"
            onClick={(e) => { e.stopPropagation(); onOpenAddBag(job.id); }}
          >
            Add Other Bag
          </Button>
          <span className={`bse-badge ${allDone ? 'bse-badge--ok' : ''}`}>
            {assignedCount}/{rows.length} bags
          </span>
          {saved && <CheckCircle2 size={14} className="bse-check-icon" />}
        </div>
      </div>

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
          <div className="bse-save-row" />
        </div>
      )}
    </div>
  );
};

// ─── Return / Edit Modal ──────────────────────────────────────────────────────
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
                  <tr key={row.rowKey} className="bse-tr"

                  >
                    <td className="bse-td bse-td--sr">{idx + 1}</td>
                    <td className="bse-td bse-td--mat">
                      <span className="bse-mat" style={{ color: matColor(row.item) }}>
                        {matLabel(row.item)}
                      </span>
                    </td>
                    <td className="bse-td bse-td--desc">
                      {row.shape} · {row.quality} · {row.color}
                    </td>
                    <td className="bse-td bse-td--bag">
                      {bag ? (
                        <span>
                          {bag.rfbag}{' '}
                          <span className={`bse-owner-badge ${bag.iscompany == 1 ? 'bse-owner-badge--company' : 'bse-owner-badge--customer'}`}>
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

// ── Sidebar helpers ───────────────────────────────────────────────────────────
const sidebarRowsOf = (allRows = []) => {
  const specKey = (r) =>
    r.itemid === 5
      ? `${r.itemid}|${norm(r.findingtypename)}|${norm(r.findingAccessories)}`
      : `${r.itemid}|${norm(r.shape)}|${norm(r.quality)}|${norm(r.color)}|${norm(r.size)}`;
  const specWithAnyBag = new Set(
    allRows.filter((r) => r.matchedBag || r.manualBag).map(specKey)
  );
  return allRows.filter((r) => (r.matchedBag || r.manualBag) || !specWithAnyBag.has(specKey(r)));
};

const rowTotals = (rows = [], inputs = {}) => {
  const engaged = rows.filter((r) => r.matchedBag || r.manualBag).length;
  return {
    rows: rows.length,
    engaged,
    noEngage: rows.length - engaged,
    reqPcs: rows.reduce((a, r) => a + (r.reqPcs || 0), 0),
    reqWt: rows.reduce((a, r) => a + (r.reqWt || 0), 0),
    entryPcs: rows.reduce((a, r) => a + (parseFloat(inputs[r.rowKey]?.pcs) || 0), 0),
    entryWt: rows.reduce((a, r) => a + (parseFloat(inputs[r.rowKey]?.cwt) || 0), 0),
  };
};

// ─── Main export ──────────────────────────────────────────────────────────────
const BulkSingleEntry = ({ state, actions, onRegisterContinue }) => {
  const [sessionData] = useState(() => ({
    ScannedMaterials: getSession('scannedJobMaterialData'),
    ScannedBags: getSession('scannedBagData'),
    OtherScannedBags: getSession('scannedOtherBagData'), // NEW
    AllBagListData: getSession('allBagListData'),
    AllEngagedMaterial: getSession('allEngagedMaterial'),
    ScannedJobList: getSession('scannedJobListData'),
  }));
  const { ScannedMaterials, ScannedBags, OtherScannedBags, AllBagListData, AllEngagedMaterial, ScannedJobList } = sessionData;

  const jobs = useMemo(
    () => (state?.scannedJobs?.length > 0 ? state.scannedJobs : []),
    [state?.scannedJobs]
  );

  const userEditedRef = useRef(new Set());
  const autoFillRef = useRef(true);

  // ── initData: build rows + initial inputs once on mount ──────────────────
  const [initData] = useState(() => {
    const map = {};
    const inputsInit = {};
    const engagedLockedInit = new Set();
    // ✅ Track which rowKeys were restored from saved state so autoFill skips them
    const restoredRowKeys = new Set();
    const matType = state?.materialType || 'all';

    jobs.forEach((j) => {
      const existing = state.jobEntries?.[j.id];

      // ✅ Restore from saved state whenever bags exist (not just when txnid present)
      if (existing?.bags?.length > 0) {
        map[j.id] = existing.bags.map(bag => ({
          rowKey: bag.rowKey || `${norm(j.id)}||${bag.qid}`,
          qid: bag.qid,
          jid: bag.jid,
          item: bag.item || '',
          itemid: bag.itemid || 0,
          IsCenterStone: bag.IsCenterStone ?? 0,
          stone_uniqueno: bag.stone_uniqueno || '',
          MaterialTypeName: bag.MaterialTypeName || '',
          isOtherBag: bag.isOtherBag || false,   // ← NEW
          shape: bag.shape || '',
          quality: bag.quality || '',
          color: bag.color || '',
          size: bag.size || '',
          findingtypename: bag.findingtypename || '',
          findingAccessories: bag.findingAccessories || '',
          reqPcs: bag.requiredPcs ?? 0,
          reqWt: bag.requiredWt ?? 0,
          isUnusedBag: bag.isUnusedBag || false,
          requiredBagNotScanned: false,
          requiredBagRfbag: null,
          matchedBag: bag.rfbag
            ? (() => {
              const live =
                ScannedBags.find(b => norm(b.rfbag) === norm(bag.rfbag)) ||
                AllBagListData?.find(b => norm(b.rfbag) === norm(bag.rfbag));
              return {
                rfbag: bag.rfbag,
                pcs: live ? (live.rempcs ?? live.pcs ?? Number(live.scannedPcs ?? 0)) : 0,
                wt: live ? (live.remwt ?? live.wt ?? Number(live.scannedCwt ?? 0)) : 0,
                iscompany: bag.iscompany,
              };
            })()
            : null,
          manualBag: null,
          txnid: bag.txnid ?? null,
        }));

        existing.bags.forEach(bag => {
          if (!bag.rowKey) return;
          // ✅ Restore user-entered pcs/wt from saved state
          inputsInit[bag.rowKey] = {
            pcs: String(bag.pcs ?? ''),
            cwt: String(bag.wt ?? ''),
          };
          // ✅ Mark as restored so autoFill effect won't overwrite on mount
          restoredRowKeys.add(bag.rowKey);
          // Lock only rows truly engaged via SP (have real txnid)
          if (bag.rfbag && bag.txnid && bag.txnid !== '0' && bag.txnid !== 'null') {
            engagedLockedInit.add(bag.rowKey);
          }
        });

      } else {
        // ── Fresh build: no saved state yet ────────────────────────────────
        const rows = buildJobRows(
          j.id, ScannedMaterials, ScannedBags, matType,
          state.requiredBags ?? [], state.scannedBags ?? []
        );

        rows.forEach(row => {
          if (!row.matchedBag) return;
          const engaged = getEngagedTotals(AllEngagedMaterial, j.id, row);
          if (engaged) {
            inputsInit[row.rowKey] = {
              pcs: String(engaged.pcs),
              cwt: engaged.wt.toFixed(3),
            };
            if (engaged.txnid && engaged.txnid !== '0') {
              engagedLockedInit.add(row.rowKey);
              row.txnid = engaged.txnid;
            } else {
              row.txnid = null;
            }
          } else {
            const availWt = Number(row.matchedBag?.wt) || 0;
            const availPcs = Number(row.matchedBag?.pcs) || 0;
            inputsInit[row.rowKey] = {
              pcs: String(Math.min(row.reqPcs ?? 0, availPcs)),
              cwt: Math.min(Number(row.reqWt ?? 0), availWt).toFixed(3),
            };
          }
        });

        // ── Extra engaged rows from allEngagedMaterial ──────────────────────
        const egMap = {};
        (AllEngagedMaterial || []).forEach(e => {
          if (!e.isengage) return;
          if (norm(e.serialjobno) !== norm(j.id)) return;
          if (!materialTypeFilter(e, matType)) return;
          const key = [
            norm(e.rfbag), e.itemid,
            norm(e.shape || ''), norm(e.Quality || ''),
            norm(e.color || ''), norm(e.Size || ''),
            norm(e.findingtypename || ''), norm(e.findingAccessories || ''),
          ].join('|');
          if (!egMap[key]) egMap[key] = { ...e, totalPcs: 0, totalWt: 0, txnids: new Set() };
          egMap[key].totalPcs += Number(e.isspcs || 0);
          egMap[key].totalWt += Number(e.isswt || 0);
          if (e.txnid !== undefined && e.txnid !== null && e.txnid !== '') {
            egMap[key].txnids.add(e.txnid);
          }
        });

        const extraRows = Object.values(egMap)
          .filter(e =>
            !rows.some(line => {
              if (!line.matchedBag || norm(line.matchedBag.rfbag) !== norm(e.rfbag)) return false;
              if (e.itemid !== line.itemid) return false;
              if (line.itemid === 5) {
                return (
                  norm(e.findingtypename || '') === norm(line.findingtypename || '') &&
                  norm(e.findingAccessories || '') === norm(line.findingAccessories || '')
                );
              }
              return (
                norm(e.shape || '') === norm(line.shape || '') &&
                norm(e.Quality || '') === norm(line.quality || '') &&
                norm(e.color || '') === norm(line.color || '')
              );
            })
          )
          .map((e, idx) => {
            const rawBag =
              AllBagListData.find(b => norm(b.rfbag) === norm(e.rfbag)) ||
              ScannedBags.find(b => norm(b.rfbag) === norm(e.rfbag));
            const bagPcs = rawBag ? (rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0)) : 0;
            const bagWt = rawBag ? (rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0)) : 0;
            const iscompany = rawBag ? rawBag.iscompany : undefined;
            const rowKey = `extra-${norm(e.rfbag)}-${e.itemid}-${idx}`;
            const baseName =
              e.itemid === 3 ? 'DIAMOND' :
                e.itemid === 4 ? 'COLORSTONE' :
                  e.itemid === 5 ? 'FINDING' : 'MISC';
            const itemName = withCenterSuffix(baseName, e);
            const txnidList = [...e.txnids];

            inputsInit[rowKey] = { pcs: String(e.totalPcs), cwt: e.totalWt.toFixed(3) };
            engagedLockedInit.add(rowKey);

            return {
              rowKey,
              qid: e.qid ?? null,
              jid: e.jid ?? null,
              item: itemName,
              itemid: e.itemid,
              IsCenterStone: e.IsCenterStone ?? 0,
              stone_uniqueno: e.stone_uniqueno || '',
              MaterialTypeName: null,
              shape: e.shape || '',
              quality: e.Quality || '',
              color: e.color || '',
              size: e.Size || '',
              findingtypename: e.findingtypename || '',
              findingAccessories: e.findingAccessories || '',
              reqPcs: e.totalPcs,
              reqWt: e.totalWt,
              isUnusedBag: false,
              isExtraEngaged: true,
              requiredBagNotScanned: false,
              requiredBagRfbag: null,
              matchedBag: { rfbag: e.rfbag, pcs: bagPcs, wt: bagWt, iscompany },
              manualBag: null,
              txnid: txnidList.length ? txnidList.join(',') : null,
            };
          });

        map[j.id] = [...rows, ...extraRows];
      }
    });

    return { map, inputsInit, engagedLockedInit, restoredRowKeys };
  });

  const [jobRows, setJobRows] = useState(initData.map);
  const [inputs, setInputs] = useState(() => ({ ...initData.inputsInit }));
  const [engagedLocked, setEngagedLocked] = useState(initData.engagedLockedInit);
  const [engagedUnlocked, setEngagedUnlocked] = useState(() => new Set());
  const [inputErrors, setInputErrors] = useState({});
  const [savedJobs, setSavedJobs] = useState(() => new Set(Object.keys(state.jobEntries ?? {})));
  const [addBagJobId, setAddBagJobId] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [autoFill, setAutoFill] = useState(true);

  // ✅ Pre-populate userEditedRef with restored rowKeys so autoFill effect skips them
  useEffect(() => {
    initData.restoredRowKeys.forEach(rk => userEditedRef.current.add(rk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [openMap, setOpenMap] = useState(() => {
    const init = {};
    jobs.forEach(j => { init[j.id] = true; });
    return init;
  });
  const allOpen = jobs.length > 0 && jobs.every(j => openMap[j.id]);

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

  // ✅ autoFill effect — skips restored rows (they're in userEditedRef)
  useEffect(() => {
    setInputs((prev) => {
      const next = { ...prev };
      const allRows = Object.values(jobRows).flat();
      const committed = (r) =>
        engagedLocked.has(r.rowKey) || engagedUnlocked.has(r.rowKey);

      allRows.forEach((r) => {
        if (committed(r)) return;
        const bag = r.matchedBag || r.manualBag;
        if (!bag) return;
        if (autoFillRef.current) {
          if (userEditedRef.current.has(r.rowKey)) return; // ← skips restored rows
          const availWt = Number(bag.wt) || 0;
          const fillWt = Math.min(r.reqWt, availWt);
          next[r.rowKey] = { pcs: String(r.reqPcs), cwt: fillWt.toFixed(3) };
        } else {
          next[r.rowKey] = { pcs: '', cwt: '' };
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFill]);

  const toggleJobOpen = (jobId) => setOpenMap(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  const toggleAllOpen = () => {
    const next = !allOpen;
    const updated = {};
    jobs.forEach(j => { updated[j.id] = next; });
    setOpenMap(updated);
  };

  const handleInput = (rowKey, field, val) => {
    userEditedRef.current.add(rowKey);
    setInputs((prev) => {
      let sanitizedVal = val;
      const allRows = Object.values(jobRows).flat();
      const row = allRows.find((r) => r.rowKey === rowKey);
      const bag = row?.matchedBag || row?.manualBag;

      if (field === 'cwt' && bag) {
        const avail = Number(bag.wt) || 0;
        const target = norm(bag.rfbag);
        let otherUsed = 0;
        allRows.forEach((r) => {
          if (r.rowKey === rowKey) return;
          const rb = r.matchedBag || r.manualBag;
          if (rb && norm(rb.rfbag) === target) {
            otherUsed += parseFloat(prev[r.rowKey]?.cwt) || 0;
          }
        });
        const remaining = Math.max(0, avail - otherUsed);
        const entered = parseFloat(val) || 0;
        if (entered > remaining + 1e-6) {
          sanitizedVal = Number(remaining).toFixed(3);
        }
        setInputErrors((pe) => ({ ...pe, [`${rowKey}-cwt`]: false }));
      } else if (field === 'pcs' && bag) {
        let otherPcs = 0;
        allRows.forEach((r) => {
          if (r.rowKey === rowKey) return;
          const rb = r.matchedBag || r.manualBag;
          if (rb && norm(rb.rfbag) === norm(bag.rfbag)) {
            otherPcs += parseFloat(prev[r.rowKey]?.pcs) || 0;
          }
        });
        const remaining = Math.max(0, (Number(bag.pcs) || 0) - otherPcs);
        setInputErrors((pe) => ({
          ...pe,
          [`${rowKey}-pcs`]: (parseFloat(val) || 0) > remaining + 1e-6,
        }));
      }

      return { ...prev, [rowKey]: { ...prev[rowKey], [field]: sanitizedVal } };
    });
  };

  const handleAssignToJob = (jobId, rowKey, bag) => {
    setJobRows((prev) => ({
      ...prev,
      [jobId]: prev[jobId].map((r) =>
        r.rowKey === rowKey ? { ...r, manualBag: bag, isUnusedBag: true, requiredBagNotScanned: false } : r
      ),
    }));
    setInputs((prev) => {
      if (prev[rowKey]?.pcs || prev[rowKey]?.cwt) return prev;
      const row = jobRows[jobId]?.find((r) => r.rowKey === rowKey);
      if (!autoFill) {
        return { ...prev, [rowKey]: { pcs: '', cwt: '' } };
      }
      return {
        ...prev,
        [rowKey]: {
          pcs: String(Math.min(Number(row?.reqPcs) || 0, Number(bag.pcs) || 0)),
          cwt: Math.min(Number(row?.reqWt) || 0, Number(bag.wt) || 0).toFixed(3),
        },
      };
    });
  };


  const autoOtherBagAppliedRef = useRef(false);
  useEffect(() => {
    if (autoOtherBagAppliedRef.current) return;
    autoOtherBagAppliedRef.current = true;
    if (!OtherScannedBags?.length) return;

    const usedRfbags = new Set();
    const newInputs = {};

    setJobRows((prevJobRows) => {
      const nextJobRows = { ...prevJobRows };

      // Pass 1: try to slot each other-bag into an EXACT-spec pending row,
      // same as before (item/shape/quality/color/size or finding type match).
      jobs.forEach((job) => {
        const rows = nextJobRows[job.id] || [];
        nextJobRows[job.id] = rows.map((row) => {
          if (row.matchedBag || row.manualBag) return row;

          const candidate = OtherScannedBags.find((b) => {
            const rf = norm(b.rfbag);
            if (usedRfbags.has(rf)) return false;
            const pcs = b.rempcs ?? b.pcs ?? Number(b.scannedPcs ?? 0);
            const wt = b.remwt ?? b.wt ?? Number(b.scannedCwt ?? 0);
            if ((Number(pcs) || 0) <= 0 || (Number(wt) || 0) <= 0) return false;
            return bagMatchesRow(
              { itemid: b.itemid, shape: b.shape, quality: b.quality, color_name: b.color_name, size: b.size, findingtypename: b.findingtypename, findingAccessories: b.findingAccessories },
              row
            );
          });

          if (!candidate) return row;

          usedRfbags.add(norm(candidate.rfbag));
          const bag = {
            rfbag: candidate.rfbag,
            pcs: candidate.rempcs ?? candidate.pcs ?? Number(candidate.scannedPcs ?? 0),
            wt: candidate.remwt ?? candidate.wt ?? Number(candidate.scannedCwt ?? 0),
            iscompany: candidate.iscompany,
          };

          newInputs[row.rowKey] = {
            pcs: String(Math.min(Number(row.reqPcs) || 0, Number(bag.pcs) || 0)),
            cwt: Math.min(Number(row.reqWt) || 0, Number(bag.wt) || 0).toFixed(3),
          };

          return { ...row, manualBag: bag, isUnusedBag: true, requiredBagNotScanned: false };
        });
      });

      // Pass 2: any other-bag that found NO matching spec anywhere gets added
      // as a trailing "Other Bag" row on EVERY job, so it's visible and usable
      // instead of silently disappearing. Left as shared stock — quantity is
      // NOT pre-filled here (a 501-pcs bag added to 5 jobs must not default to
      // 501 pcs in each; you type how much this job actually uses, and the
      // existing Avl: hint tracks the shared remaining stock across jobs).
      const leftoverBags = OtherScannedBags.filter((b) => !usedRfbags.has(norm(b.rfbag)));

      leftoverBags.forEach((b) => {
        const pcs = b.rempcs ?? b.pcs ?? Number(b.scannedPcs ?? 0);
        const wt = b.remwt ?? b.wt ?? Number(b.scannedCwt ?? 0);
        if ((Number(pcs) || 0) <= 0 || (Number(wt) || 0) <= 0) return;

        const baseName = b.itemid === 3 ? 'DIAMOND' : b.itemid === 4 ? 'COLORSTONE' : b.itemid === 5 ? 'FINDING' : 'MISC';
        const item = withCenterSuffix(baseName, b);

        jobs.forEach((job) => {
          const rows = nextJobRows[job.id] || [];
          const rowKey = `other-auto-${norm(b.rfbag)}-${job.id}`;
          if (rows.some((r) => r.rowKey === rowKey)) return; // already added, don't duplicate

          const newRow = {
            rowKey,
            qid: null,
            jid: job.jid ?? null,
            item, itemid: b.itemid,
            IsCenterStone: b.IsCenterStone ?? 0,
            stone_uniqueno: b.stone_uniqueno || '',
            MaterialTypeName: 'Other Bag',
            isOtherBag: true,
            shape: b.shape || '', quality: b.quality || '',
            color: b.color_name || b.color || '', size: b.size || '',
            findingtypename: b.findingtypename || '', findingAccessories: b.findingAccessories || '',
            reqPcs: 0, reqWt: 0,
            matchedBag: { rfbag: b.rfbag, pcs: Number(pcs), wt: Number(wt), iscompany: b.iscompany },
            manualBag: null,
            isUnusedBag: true, isExtraEngaged: false,
            requiredBagNotScanned: false, requiredBagRfbag: null,
            txnid: null,
          };
          nextJobRows[job.id] = [...rows, newRow];
          newInputs[rowKey] = { pcs: '', cwt: '' };
        });
      });

      return nextJobRows;
    });

    if (Object.keys(newInputs).length) {
      setInputs((prev) => ({ ...prev, ...newInputs }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddNewBag = (jobId, bag) => {
    const baseName = bag.itemid === 3 ? 'DIAMOND' : bag.itemid === 4 ? 'COLORSTONE' : bag.itemid === 5 ? 'FINDING' : 'MISC';
    const item = withCenterSuffix(baseName, bag);
    const rowKey = `other-${norm(bag.rfbag)}-${bag.itemid}-${Date.now()}`;
    const matchedJob = jobs.find((j) => j.id === jobId);
    const newRow = {
      rowKey,
      qid: null,
      jid: matchedJob?.jid ?? null,
      item, itemid: bag.itemid,
      IsCenterStone: bag.IsCenterStone ?? 0,
      stone_uniqueno: bag.stone_uniqueno || '',
      MaterialTypeName: 'Other Bag',   // ← shows "Other Bag" in the Material column instead of Diamond/Colorstone/etc
      isOtherBag: true,                // ← NEW flag, used below to force this row to the bottom
      shape: bag.shape || '', quality: bag.quality || '',
      color: bag.color_name || bag.color || '', size: bag.size || '',
      findingtypename: bag.findingtypename || '', findingAccessories: bag.findingAccessories || '',
      reqPcs: 0, reqWt: 0,
      matchedBag: null, manualBag: bag,
      isUnusedBag: true, isExtraEngaged: false,
      requiredBagNotScanned: false, requiredBagRfbag: null,
      txnid: null,
    };
    setJobRows((prev) => ({
      ...prev,
      [jobId]: [...(prev[jobId] || []), newRow],
    }));
    setInputs((prev) => ({
      ...prev,
      [rowKey]: {
        pcs: String(Number(bag.pcs) || 0),
        cwt: Number(bag.wt || 0).toFixed(3),
      },
    }));
    setOpenMap((prev) => ({ ...prev, [jobId]: true }));
  };

  const inputsRef = useRef(inputs);
  useEffect(() => { inputsRef.current = inputs; }, [inputs]);

  const handleSaveAll = () => {
    const currentInputs = inputsRef.current;
    jobs.forEach((j) => {
      const rows = jobRows[j.id] || [];
      const entries = rows.map((r) => {
        const bag = r.matchedBag || r.manualBag;
        return {
          rowKey: r.rowKey, qid: r.qid, jid: r.jid ?? j.jid ?? null,
          serialjobno: j.id, isUnusedBag: r.isUnusedBag,
          isOtherBag: r.isOtherBag || false,   // ← NEW
          item: r.item, itemid: r.itemid,
          IsCenterStone: r.IsCenterStone ?? 0,
          stone_uniqueno: r.stone_uniqueno || '',
          MaterialTypeName: r.MaterialTypeName,
          shape: r.shape, quality: r.quality, color: r.color, size: r.size,
          findingtypename: r.findingtypename || '', findingAccessories: r.findingAccessories || '',
          requiredPcs: r.reqPcs, requiredWt: r.reqWt,
          rfbag: bag?.rfbag ?? null,
          bag: bag ? { rfbag: bag.rfbag ?? '' } : null,
          iscompany: bag?.iscompany ?? null,
          txnid: r.txnid ?? null,
          pcs: parseFloat(currentInputs[r.rowKey]?.pcs) || 0,
          wt: parseFloat(currentInputs[r.rowKey]?.cwt) || 0,
        };
      });
      actions?.updateJobEntry?.(j.id, { bags: entries });
    });
    setSavedJobs(new Set(jobs.map(j => j.id)));
  };

  const saveRef = useRef(handleSaveAll);
  saveRef.current = handleSaveAll;

  useEffect(() => {
    if (onRegisterContinue) {
      onRegisterContinue(() => saveRef.current());
      return () => onRegisterContinue(null);
    }
  }, [onRegisterContinue]);

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
    const matchedJob = jobs.find((j) => j.id === jobId);
    const fallbackJid = matchedJob?.jid ?? null;
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, qid: r.qid, jid: r.jid ?? fallbackJid,
        serialjobno: jobId, isUnusedBag: r.isUnusedBag,
        item: r.item, itemid: r.itemid,
        IsCenterStone: r.IsCenterStone ?? 0,
        isOtherBag: r.isOtherBag || false,   // ← NEW
        stone_uniqueno: r.stone_uniqueno || '',
        MaterialTypeName: r.MaterialTypeName,
        shape: r.shape, quality: r.quality, color: r.color, size: r.size,
        findingtypename: r.findingtypename || '', findingAccessories: r.findingAccessories || '',
        requiredPcs: r.reqPcs, requiredWt: r.reqWt,
        rfbag: bag?.rfbag ?? null,
        bag: bag ? { rfbag: bag.rfbag ?? '' } : null,
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
        isOtherBag: r.isOtherBag || false,   // ← NEW
        IsCenterStone: r.IsCenterStone ?? 0,
        stone_uniqueno: r.stone_uniqueno || '',
        rfbag: bag?.rfbag ?? null,
        shape: r.shape, quality: r.quality, color: r.color, size: r.size,
        findingtypename: r.findingtypename || '', findingAccessories: r.findingAccessories || '',
        bag: bag ? { rfbag: bag.rfbag ?? '' } : null,
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

  const grandTotals = useMemo(() => {
    return jobs.reduce((acc, j) => {
      const t = rowTotals(sidebarRowsOf(jobRows[j.id] || []), inputs);
      return {
        rows: acc.rows + t.rows,
        engaged: acc.engaged + t.engaged,
        noEngage: acc.noEngage + t.noEngage,
        reqPcs: acc.reqPcs + t.reqPcs,
        reqWt: acc.reqWt + t.reqWt,
        entryPcs: acc.entryPcs + t.entryPcs,
        entryWt: acc.entryWt + t.entryWt,
      };
    }, { rows: 0, engaged: 0, noEngage: 0, reqPcs: 0, reqWt: 0, entryPcs: 0, entryWt: 0 });
  }, [jobs, jobRows, inputs]);

  // Bags available to "Add Other Bag" for ANY job — required-scan bags
  // plus the extra ones scanned on the Bag Scanning page.
  const allScannedBagsForModal = useMemo(() => {
    const map = new Map();
    [...ScannedBags, ...OtherScannedBags].forEach((b) => {
      const key = norm(b.rfbag);
      if (key && !map.has(key)) map.set(key, b);
    });
    return Array.from(map.values());
  }, [ScannedBags, OtherScannedBags]);

  return (
    <div className="bse-layout">
      <div className="bse-root">
        <div className="bse-topbar">
          {jobs.length > 0 && (
            <button
              type="button"
              className="bse-expand-all-btn"
              onClick={toggleAllOpen}
              title={allOpen ? 'Collapse all jobs' : 'Expand all jobs'}
            >
              {allOpen ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
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
                onChange={(e) => {
                  autoFillRef.current = e.target.checked;
                  userEditedRef.current.clear();
                  setAutoFill(e.target.checked);
                }}
                size="small"
                color="primary"
              />
            }
            label="Auto Fill"
          />
        </div>

        <div className="bse-scroll">
          {jobs.map((job) => {
            const rows = jobRows[job.id] || [];
            if (rows.length === 0)
              return (
                <div key={job.id} className="bse-empty-job">
                  <div className="bse-empty-job__info">
                    <Info size={13} />
                    <span>Job <strong>{job.id}</strong> — no material lines found in system data.</span>
                  </div>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setAddBagJobId(job.id)}
                    className="bse-empty-job__add-btn"
                  >
                    + Add Other Bag
                  </Button>
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
            onAddNew={handleAddNewBag}
            onClose={() => setAddBagJobId(null)}
            scannedBags={allScannedBagsForModal}
            AllBagListData={AllBagListData}
            scannedJobList={ScannedJobList}
            selectedLockerName={state.locker?.name || ''}
            jobEntries={state.jobEntries}
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

      {saved > 0 && (
        <div className="bse-sidebar">
          <div className="bse-sidebar__title"><CheckCircle2 size={14} /> Total Summary</div>
          {jobs.map(j => {
            const allRows = jobRows[j.id] || [];
            const isSaved = savedJobs.has(j.id);
            const t = rowTotals(sidebarRowsOf(allRows), inputs);
            return (
              <div key={j.id} className={`bse-sidebar__job ${isSaved ? 'bse-sidebar__job--saved' : ''}`}>
                <div className="bse-sidebar__job-head">
                  <strong>{j.id}</strong>
                  <span className="bse-sidebar__meta">
                    {isSaved && <CheckCircle2 size={10} style={{ color: '#16a34a', marginRight: 3 }} />}
                    {t.engaged}/{t.rows} engaged
                    {t.noEngage > 0 && <span className="bse-sidebar__no-bag-pill">{t.noEngage} No Engage</span>}
                  </span>
                </div>
                <div className="bse-sidebar__stats">
                  <div className="bse-sidebar__stat">
                    <span>PCS</span>
                    <b>{t.entryPcs}</b>
                    <i>/ {t.reqPcs}</i>
                  </div>
                  <div className="bse-sidebar__stat">
                    <span>CTW</span>
                    <b>{t.entryWt.toFixed(3)}</b>
                    <i>/ {t.reqWt.toFixed(3)}</i>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="bse-sidebar__grand">
            <div className="bse-sidebar__grand-head">
              Grand Total · {jobs.length} job{jobs.length > 1 ? 's' : ''}
            </div>
            <div className="bse-sidebar__stats">
              <div className="bse-sidebar__stat">
                <span>PCS</span>
                <b>{grandTotals.entryPcs}</b>
                <i>/ {grandTotals.reqPcs}</i>
              </div>
              <div className="bse-sidebar__stat">
                <span>CTW</span>
                <b>{grandTotals.entryWt.toFixed(3)}</b>
                <i>/ {grandTotals.reqWt.toFixed(3)}</i>
              </div>
              <div className="bse-sidebar__stat">
                <span>ENGAGED</span>
                <b>{grandTotals.engaged}</b>
                <i>/ {grandTotals.rows}</i>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkSingleEntry;