import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, ScanLine,
  Package, Gem, Palette, Wrench,
  CheckCircle2, Save, Plus, AlertCircle, X, Info, Pencil, RotateCcw,
} from 'lucide-react';
import Button from '@mui/material/Button';
import './Bulksingleentry.scss';


const SampleJobData = JSON.parse(sessionStorage.getItem("allJobListData"))
const SampleBagData = []
// ─── Utilities ────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').trim().toUpperCase();


const findMatchingBag = (jobLine, scannedBags) =>
  scannedBags.find(
    (bag) =>
      norm(bag.shape) === norm(jobLine.shape) &&
      norm(bag.quality) === norm(jobLine.Quality) &&
      norm(bag.color_name) === norm(jobLine.color) &&
      norm(bag.size) === norm(jobLine.size)
  ) || null;

const findBagById = (id, scannedBags) =>
  scannedBags.find((b) => norm(b.rfbag) === norm(id)) || null;

const matColor = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND')) return '#1565c0';
  if (u.includes('COLORSTONE')) return '#7b1fa2';
  if (u.includes('FINDING') || u.includes('MISC')) return '#e65100';
  return '#607d8b';
};

const matIcon = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND')) return <Gem size={12} />;
  if (u.includes('COLORSTONE')) return <Palette size={12} />;
  if (u.includes('FINDING') || u.includes('MISC')) return <Wrench size={12} />;
  return <Package size={12} />;
};

const matLabel = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND')) return 'Diamond';
  if (u.includes('COLORSTONE')) return 'Colorstone';
  if (u.includes('FINDING')) return 'Finding';
  return item;
};

const MATERIAL_ITEMID_MAP = { all: null, diamond: [3], colorstone: [4], misc: [5] };

const convertRawBagToScanned = (rawBag) => ({
  id: rawBag.rfbag, label: rawBag.rfbag, rfbag: rawBag.rfbag,
  itemid: rawBag.itemid,
  type: rawBag.itemid === 3 ? 'Diamond' : rawBag.itemid === 4 ? 'Colorstone' : 'Finding / Misc',
  color: rawBag.itemid === 3 ? '#e91e63' : rawBag.itemid === 4 ? '#9c27b0' : '#ff9800',
  shape: rawBag.shape, quality: rawBag.Quality, size: rawBag.Size,
  wt: rawBag.wt, pcs: rawBag.pcs, supplier: rawBag.supplier,
  color_name: rawBag.color, shapeid: rawBag.shapeid,
});

/**
 * Build rows for a given SerialJobNo, filtered by materialType.
 */
const buildJobRows = (serialJobNo, scannedBags, materialType = 'all') => {
  const allowedItemIds = MATERIAL_ITEMID_MAP[materialType] ?? null;
  return SampleJobData
    .filter((d) => d.serialjobno === serialJobNo)
    .filter((d) => !allowedItemIds || allowedItemIds.includes(d.itemid))
    .map((line, idx) => ({
      rowKey: `${serialJobNo}||${line.qid ?? idx}`,
      qid: line.qid,
      item: line.item,
      itemid: line.itemid,
      shape: line.shape,
      quality: line.Quality,
      color: line.color,
      size: line.size,
      reqPcs: line.pcs,
      reqWt: line.wt,
      matchedBag: findMatchingBag(line, scannedBags),
      manualBag: null,
    }));
};

// ─── Add-Bag Modal ────────────────────────────────────────────────────────────
const AddBagModal = ({ rowKey, onAssign, onClose, scannedBags, onAddNewBag }) => {
  const [val, setVal] = useState('');
  const [error, setError] = useState('');
  const [found, setFound] = useState(null);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const check = () => {
    const t = val.trim();
    if (!t) return;
    let bag = findBagById(t, scannedBags);
    if (!bag) {
      const rawBag = SampleBagData.find((b) => norm(b.rfbag) === norm(t));
      if (rawBag) {
        bag = convertRawBagToScanned(rawBag);
        onAddNewBag(bag);
      }
    }
    if (!bag) { setError(`Bag "${t}" not found in system.`); setFound(null); }
    else { setError(''); setFound(bag); }
  };

  return (
    <div className="bse-modal-backdrop" onClick={onClose}>
      <div className="bse-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bse-modal__close" onClick={onClose}><X size={15} /></button>
        <div className="bse-modal__icon"><ScanLine size={24} /></div>
        <h3>Assign Bag</h3>
        <p>Scan or type a bag barcode — validated against system.</p>
        <div className="bse-modal__row">
          <input
            ref={ref}
            className="bse-modal__input"
            placeholder="e.g. 0000000048"
            value={val}
            onChange={(e) => { setVal(e.target.value); setError(''); setFound(null); }}
            onKeyDown={(e) => e.key === 'Enter' && check()}
          />
          <button className="bse-modal__check-btn" onClick={check}>Check</button>
        </div>
        {error && <div className="bse-modal__error"><AlertCircle size={12} />{error}</div>}
        {found && (
          <>
            <div className="bse-modal__found">
              <CheckCircle2 size={12} />
              <div>
                <strong>{found.rfbag}</strong>
                <span>{found.shape} · {found.quality} · {found.color_name} · {found.size}</span>
                <span>Stock: {found.pcs} pcs / {Number(found.wt).toFixed(3)} ct</span>
              </div>
            </div>
            <button className="bse-modal__confirm-btn" onClick={() => { onAssign(rowKey, found); onClose(); }}>
              Assign This Bag
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Single table row ─────────────────────────────────────────────────────────
const MatRow = ({ sr, row, onAddBag, onInput, inputVals, locked }) => {
  const bag = row.matchedBag || row.manualBag;
  const isAuto = !!row.matchedBag;
  const color = matColor(row.item);

  return (
    <tr className={`bse-tr ${bag ? 'bse-tr--bag' : 'bse-tr--nobag'}`}>
      <td className="bse-td bse-td--sr">{sr}</td>

      <td className="bse-td bse-td--mat">
        <span className="bse-mat" style={{ color }}>
          {matIcon(row.item)}{matLabel(row.item)}
        </span>
      </td>

      <td className="bse-td bse-td--desc">
        {row.shape} · {row.quality} · {row.color}{row.size ? ` · ${row.size}` : ''}
      </td>

      <td className="bse-td bse-td--bag">
        {bag
          ? <span className={`bse-chip bse-chip--${isAuto ? 'auto' : 'manual'}`}>{isAuto ? '⚡' : '✋'} {bag.rfbag}</span>
          : <span className="bse-chip bse-chip--none">No bag</span>
        }
      </td>

      {/* Required */}
      <td className="bse-td bse-td--num">{row.reqPcs}</td>
      <td className="bse-td bse-td--num">{row.reqWt.toFixed(3)}</td>

      {/* Entry + Available hint below */}
      <td className="bse-td bse-td--entry">
        {locked
          ? <span className="bse-locked-val">{inputVals?.pcs || '—'}</span>
          : bag
            ? <div className="bse-entry-cell">
              <input type="number" className="bse-inp" placeholder={String(row.reqPcs)} value={inputVals?.pcs ?? ''} onChange={(e) => onInput(row.rowKey, 'pcs', e.target.value)} />
              <span className="bse-avl-hint">Avl: {bag.pcs}</span>
            </div>
            : <button className="bse-add-btn" onClick={() => onAddBag(row.rowKey)}><Plus size={11} />Add</button>
        }
      </td>
      <td className="bse-td bse-td--entry">
        {locked
          ? <span className="bse-locked-val">{inputVals?.cwt || '—'}</span>
          : bag
            ? <div className="bse-entry-cell">
              <input type="number" step="0.001" className="bse-inp" placeholder={row.reqWt.toFixed(3)} value={inputVals?.cwt ?? ''} onChange={(e) => onInput(row.rowKey, 'cwt', e.target.value)} />
              <span className="bse-avl-hint">Avl: {Number(bag.wt).toFixed(3)}</span>
            </div>
            : <span className="bse-muted">—</span>
        }
      </td>
    </tr>
  );
};

// ─── Job Block ────────────────────────────────────────────────────────────────
const JobBlock = ({ job, rows, onAddBag, onInput, inputs, saved, onSave, onReturn, scannedBags }) => {
  const [open, setOpen] = useState(true);
  const assignedCount = rows.filter((r) => r.matchedBag || r.manualBag).length;
  const allDone = assignedCount === rows.length;

  // header summary pills
  const groups = {};
  rows.forEach((r) => {
    const k = r.item || 'Other';
    if (!groups[k]) groups[k] = { pcs: 0, wt: 0 };
    groups[k].pcs += r.reqPcs || 0;
    groups[k].wt += r.reqWt || 0;
  });

  return (
    <div className={`bse-job ${saved ? 'bse-job--saved' : ''}`}>
      {/* Header */}
      <div className="bse-job-hdr" onClick={() => setOpen((p) => !p)}>
        <span className="bse-chevron">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="bse-job-id">{job.id}</span>
        <div className="bse-pills">
          {Object.entries(groups).map(([item, v]) => (
            <span key={item} className="bse-pill" style={{ '--pc': matColor(item) }}>
              <b>{matLabel(item)}</b>{v.wt.toFixed(3)} ct · {v.pcs} pcs
            </span>
          ))}
        </div>
        <div className="bse-job-hdr__right">
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
                <th colSpan={2} className="bse-th bse-th--group">Required</th>
                <th colSpan={2} className="bse-th bse-th--group bse-th--entry">Entry</th>
              </tr>
              <tr className="bse-thead-sub">
                <th className="bse-th bse-th--sub">PCS</th>
                <th className="bse-th bse-th--sub">CWT</th>
                <th className="bse-th bse-th--sub bse-th--entry">PCS</th>
                <th className="bse-th bse-th--sub bse-th--entry">CWT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <MatRow
                  key={row.rowKey}
                  sr={idx + 1}
                  row={row}
                  onAddBag={onAddBag}
                  onInput={saved ? () => { } : onInput}
                  inputVals={inputs[row.rowKey]}
                  locked={saved}
                />
              ))}
            </tbody>
          </table>

          <div className="bse-save-row">
            {!saved ? (
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
            )}
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
                      <span className="bse-mat" style={{ color: matColor(row.item) }}>
                        {matIcon(row.item)}{matLabel(row.item)}
                      </span>
                    </td>
                    <td className="bse-td bse-td--desc">
                      {row.shape} · {row.quality} · {row.color}
                    </td>
                    <td className="bse-td bse-td--bag">
                      {bag ? bag.rfbag : '—'}
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
const BulkSingleEntry = ({ state, actions }) => {
  const jobs = state?.scannedJobs?.length > 0
    ? state.scannedJobs
    : [{ id: '1/111' }]; // demo fallback

  const [jobRows, setJobRows] = useState(() => {
    const map = {};
    const bags = state?.scannedBags || [];
    const matType = state?.materialType || 'all';
    jobs.forEach((j) => { map[j.id] = buildJobRows(j.id, bags, matType); });
    return map;
  });

  const [inputs, setInputs] = useState({});
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null); // jobId

  const handleInput = (rowKey, field, val) =>
    setInputs((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [field]: val } }));

  const handleAddNewBag = (bag) => actions?.addScannedBag?.(bag);

  const handleAssign = (rowKey, bag) => {
    const { jobId } = modal;
    setJobRows((prev) => ({
      ...prev,
      [jobId]: prev[jobId].map((r) =>
        r.rowKey === rowKey ? { ...r, manualBag: bag } : r
      ),
    }));
  };

  const handleSave = (jobId) => {
    const rows = jobRows[jobId] || [];
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey,
        bagNo: bag?.rfbag || null,
        item: r.item,
        reqPcs: r.reqPcs,
        reqWt: r.reqWt,
        entryPcs: parseFloat(inputs[r.rowKey]?.pcs) || 0,
        entryCwt: parseFloat(inputs[r.rowKey]?.cwt) || 0,
      };
    });
    actions?.updateJobEntry?.(jobId, { entries });
    setSavedJobs((prev) => new Set([...prev, jobId]));
  };

  const handleReturn = (jobId) => setReturnModal(jobId);

  const handleReturnSave = (jobId, updatedInputs) => {
    setInputs((prev) => ({ ...prev, ...updatedInputs }));
    // Re-engage to context
    const rows = jobRows[jobId] || [];
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, bagNo: bag?.rfbag || null, item: r.item,
        reqPcs: r.reqPcs, reqWt: r.reqWt,
        entryPcs: parseFloat(updatedInputs[r.rowKey]?.pcs) || 0,
        entryCwt: parseFloat(updatedInputs[r.rowKey]?.cwt) || 0,
      };
    });
    actions?.updateJobEntry?.(jobId, { entries });
    setReturnModal(null);
  };

  const handleReturnUnlock = (jobId) => {
    setSavedJobs((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    setReturnModal(null);
  };

  const total = jobs.length;
  const saved = savedJobs.size;

  return (
    <div className="bse-layout">
      <div className="bse-root">
        {/* Top progress */}
        <div className="bse-topbar">
          <div className="bse-topbar__left">
            <span className="bse-topbar__title">Bulk → Single · Material Entry</span>
            <span className="bse-topbar__sub">{saved} / {total} jobs saved</span>
          </div>
          <div className="bse-topbar__track">
            <div className="bse-topbar__fill" style={{ width: `${total ? (saved / total) * 100 : 0}%` }} />
          </div>
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
                onAddBag={(rowKey) => setModal({ rowKey, jobId: job.id })}
                onInput={handleInput}
                inputs={inputs}
                saved={savedJobs.has(job.id)}
                onSave={handleSave}
                onReturn={handleReturn}
                scannedBags={state?.scannedBags || []}
              />
            );
          })}
        </div>

        {modal && (
          <AddBagModal
            rowKey={modal.rowKey}
            onAssign={handleAssign}
            onClose={() => setModal(null)}
            scannedBags={state?.scannedBags || []}
            onAddNewBag={handleAddNewBag}
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
          <div className="bse-sidebar__title"><CheckCircle2 size={14} /> Saved Jobs ({saved})</div>
          {jobs.filter(j => savedJobs.has(j.id)).map(j => {
            const rows = jobRows[j.id] || [];
            return (
              <div key={j.id} className="bse-sidebar__job">
                <div className="bse-sidebar__job-head">
                  <strong>{j.id}</strong>
                  <span className="bse-sidebar__meta">{rows.length} rows</span>
                </div>
                <div className="bse-sidebar__chips">
                  {rows.map(r => {
                    const bag = r.matchedBag || r.manualBag;
                    return (
                      <div key={r.rowKey} className={`bse-sidebar__chip ${!bag ? 'bse-sidebar__chip--warn' : ''}`}>
                        <span style={{ color: matColor(r.item), display: 'flex' }}>{matIcon(r.item)}</span>
                        <span className="bse-sidebar__spec">{r.shape} · {r.quality} · {r.color}</span>
                        {bag
                          ? <span className="bse-sidebar__bag">{bag.rfbag}</span>
                          : <span className="bse-sidebar__nobag">No bag</span>
                        }
                        <span className="bse-sidebar__vals">{inputs[r.rowKey]?.pcs || '—'} / {inputs[r.rowKey]?.cwt || '—'}</span>
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