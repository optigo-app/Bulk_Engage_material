import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Gem, Palette, Wrench, Package, ScanLine, Plus,
  CheckCircle2, AlertCircle, X, Info, Save, Pencil, RotateCcw,
} from 'lucide-react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import './BulkMaterialWise.scss';

// ─── Utilities ────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').trim().toUpperCase();
const SampleJobData = JSON.parse(sessionStorage.getItem("allJobListData"))
const SampleBagData = []


const findMatchingBag = (line, scannedBags) =>
  scannedBags.find(
    (b) =>
      norm(b.shape) === norm(line.shape) &&
      norm(b.quality) === norm(line.Quality) &&
      norm(b.color_name) === norm(line.color) &&
      norm(b.size) === norm(line.size)
  ) || null;

const findBagById = (id, scannedBags) =>
  scannedBags.find((b) => norm(b.rfbag) === norm(id)) || null;

const matColor = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND')) return '#e91e63';
  if (u.includes('COLORSTONE')) return '#9c27b0';
  if (u.includes('FINDING') || u.includes('MISC')) return '#ff9800';
  return '#607d8b';
};

const matIcon = (item = '', size = 13) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND')) return <Gem size={size} />;
  if (u.includes('COLORSTONE')) return <Palette size={size} />;
  if (u.includes('FINDING') || u.includes('MISC')) return <Wrench size={size} />;
  return <Package size={size} />;
};

const matLabel = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND')) return 'Diamond';
  if (u.includes('COLORSTONE')) return 'Colorstone';
  if (u.includes('FINDING')) return 'Finding';
  return item;
};

const groupKey = (line) =>
  `${norm(line.item)}|${norm(line.shape)}|${norm(line.Quality)}|${norm(line.color)}|${norm(line.size)}`;

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
 * Build merged material rows from ALL scanned jobs.
 * Rows with identical (item, shape, Quality, color, size) are MERGED:
 *   reqPcs and reqWt are summed; one bag is auto-matched.
 */
const buildMergedRows = (scannedJobs, scannedBags, materialType = 'all') => {
  const serials = scannedJobs.map((j) => j.id);
  const allowedItemIds = MATERIAL_ITEMID_MAP[materialType] ?? null;
  const lines = SampleJobData
    .filter((d) => serials.includes(d.serialjobno))
    .filter((d) => !allowedItemIds || allowedItemIds.includes(d.itemid));

  const map = new Map();
  lines.forEach((line, idx) => {
    const key = groupKey(line);
    if (!map.has(key)) {
      const bag = findMatchingBag(line, scannedBags);
      map.set(key, {
        rowKey: key,
        item: line.item,
        shape: line.shape,
        quality: line.Quality,
        color: line.color,
        size: line.size,
        reqPcs: 0,
        reqWt: 0,
        matchedBag: bag,
        manualBag: null,
        jobNos: [],
      });
    }
    const row = map.get(key);
    row.reqPcs += line.pcs || 0;
    row.reqWt += line.wt || 0;
    row.jobNos.push(line.SerialJobNo);
  });

  // deduplicate jobNos
  map.forEach((row) => {
    row.jobNos = [...new Set(row.jobNos)];
  });

  return [...map.values()];
};

const FILTERS = ['ALL', 'Diamond', 'Colorstone', 'Finding'];

// ─── Add Material Modal ───────────────────────────────────────────────────────
const AddMaterialModal = ({ onAdd, onClose, scannedBags, onAddNewBag }) => {
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
                <span>Stock: {found.pcs} pcs / {Number(found.wt).toFixed(3)} ct</span>
                {found.findingtypename && (
                  <span>{found.findingtypename}{found.findingAccessories ? ` · ${found.findingAccessories}` : ''}</span>
                )}
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
              {rows.map((row, idx) => (
                <tr key={row.rowKey} className="bmw__row">
                  <td className="bmw__td bmw__td--sr">{idx + 1}</td>
                  <td className="bmw__td bmw__td--type">
                    <span className="bmw__mat" style={{ color: matColor(row.item) }}>
                      {matIcon(row.item)}{matLabel(row.item)}
                    </span>
                  </td>
                  <td className="bmw__td bmw__td--desc">
                    {row.shape} · {row.quality} · {row.color}
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
              ))}
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

const BulkMaterialWise = ({ state, actions }) => {
  const demoJobs = [{ id: '1/111' }];
  const jobs = state?.scannedJobs?.length > 0 ? state.scannedJobs : demoJobs;

  // Build merged rows from real data
  const scannedBags = state?.scannedBags || [];
  const matType = state?.materialType || 'all';
  const baseRows = useMemo(() => buildMergedRows(jobs, scannedBags, matType), [jobs, scannedBags, matType]);

  const [rows, setRows] = useState(baseRows);
  const [filter, setFilter] = useState('ALL');
  const [autoFill, setAutoFill] = useState(true);
  const [inputs, setInputs] = useState(() => {
    const init = {};
    baseRows.forEach((r) => {
      const bag = r.matchedBag;
      init[r.rowKey] = {
        pcs: bag ? String(r.reqPcs) : '',
        cwt: bag ? r.reqWt.toFixed(3) : '',
      };
    });
    return init;
  });
  const [showModal, setShowModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [returnModal, setReturnModal] = useState(false);

  const handleAddNewBag = (bag) => actions?.addScannedBag?.(bag);

  const handleSaveAll = () => {
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, bagNo: bag?.rfbag || null, item: r.item,
        reqPcs: r.reqPcs, reqWt: r.reqWt,
        entryPcs: parseFloat(inputs[r.rowKey]?.pcs) || 0,
        entryCwt: parseFloat(inputs[r.rowKey]?.cwt) || 0,
      };
    });
    actions?.updateJobEntry?.('bulk-material', { entries });
    setIsSaved(true);
  };

  const handleReturnSave = (updatedInputs) => {
    setInputs((prev) => ({ ...prev, ...updatedInputs }));
    const entries = rows.map((r) => {
      const bag = r.matchedBag || r.manualBag;
      return {
        rowKey: r.rowKey, bagNo: bag?.rfbag || null, item: r.item,
        reqPcs: r.reqPcs, reqWt: r.reqWt,
        entryPcs: parseFloat(updatedInputs[r.rowKey]?.pcs) || 0,
        entryCwt: parseFloat(updatedInputs[r.rowKey]?.cwt) || 0,
      };
    });
    actions?.updateJobEntry?.('bulk-material', { entries });
    setReturnModal(false);
  };

  const handleReturnUnlock = () => {
    setIsSaved(false);
    setReturnModal(false);
  };

  // When autoFill changes — prefill or clear all inputs
  useEffect(() => {
    setInputs((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        const bag = r.matchedBag || r.manualBag;
        if (!bag) return;
        if (autoFill) {
          next[r.rowKey] = {
            pcs: String(r.reqPcs),
            cwt: r.reqWt.toFixed(3),
          };
        } else {
          next[r.rowKey] = { pcs: '', cwt: '' };
        }
      });
      return next;
    });
  }, [autoFill, rows]); // eslint-disable-line

  const handleInput = (rowKey, field, val) =>
    setInputs((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [field]: val } }));

  // Add material from modal
  const handleAddMaterial = (bag) => {
    const item = bag.itemid === 3 ? 'DIAMOND' : bag.itemid === 4 ? 'COLORSTONE' : 'FINDING';
    const key = `${norm(item)}|${norm(bag.shape)}|${norm(bag.quality)}|${norm(bag.color_name)}|${norm(bag.size)}`;

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
      shape: bag.shape,
      quality: bag.quality,
      color: bag.color_name,
      size: bag.size,
      reqPcs: 0,
      reqWt: 0,
      matchedBag: null,
      manualBag: bag,
      jobNos: [],
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
    : rows.filter((r) => matLabel(r.item) === filter);

  const grouped = filtered.reduce((acc, r) => {
    const k = matLabel(r.item).toUpperCase();
    if (!acc[k]) acc[k] = { item: r.item, rows: [] };
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
              <span className="bmw__summary-lbl">Req. CWT</span>
            </div>
            <div className="bmw__summary-cell bmw__summary-cell--green">
              <span className="bmw__summary-val">{totEntry.toFixed(3)}</span>
              <span className="bmw__summary-lbl">Entry CWT</span>
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
            <table className="bmw__table">
              <thead className="bmw__thead">
                <tr>
                  <th className="bmw__th bmw__th--sr">Sr</th>
                  <th className="bmw__th bmw__th--type">Material / Bag</th>
                  <th className="bmw__th bmw__th--desc">Specification</th>
                  <th className="bmw__th bmw__th--jobs">Jobs</th>
                  <th className="bmw__th bmw__th--req" colSpan={2}>Required</th>
                  <th className="bmw__th bmw__th--entry" colSpan={2}>Entry</th>
                </tr>
                <tr className="bmw__thead-sub">
                  <th colSpan={4}></th>
                  <th className="bmw__th-sub">PCS</th>
                  <th className="bmw__th-sub">CWT</th>
                  <th className="bmw__th-sub bmw__th-sub--entry">PCS</th>
                  <th className="bmw__th-sub bmw__th-sub--entry">CWT</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([groupName, { item, rows: gRows }]) => (
                  <React.Fragment key={groupName}>
                    {/* Group header */}
                    <tr className="bmw__group-row">
                      <td colSpan={8}>
                        <div className="bmw__group-label" style={{ '--gc': matColor(item) }}>
                          <span className="bmw__group-icon">{matIcon(item, 12)}</span>
                          {groupName}
                        </div>
                      </td>
                    </tr>

                    {gRows.map((row) => {
                      const bag = row.matchedBag || row.manualBag;
                      const isAuto = !!row.matchedBag;
                      const inp = inputs[row.rowKey] || { pcs: '', cwt: '' };
                      const sr = srCounter++;
                      const color = matColor(row.item);

                      return (
                        <tr
                          key={row.rowKey}
                          className={`bmw__row ${bag ? 'bmw__row--bag' : 'bmw__row--nobag'}`}
                        >
                          {/* Sr */}
                          <td className="bmw__td bmw__td--sr">{sr}</td>

                          {/* Material + bag */}
                          <td className="bmw__td bmw__td--type">
                            <span className="bmw__mat" style={{ color }}>
                              {matIcon(row.item)}{matLabel(row.item)}
                            </span>
                            {bag ? (
                              <span className={`bmw__chip bmw__chip--${isAuto ? 'auto' : 'manual'}`}>
                                {isAuto ? '⚡' : '✋'} {bag.rfbag}
                              </span>
                            ) : (
                              <span className="bmw__chip bmw__chip--none">No bag</span>
                            )}
                          </td>

                          {/* Spec */}
                          <td className="bmw__td bmw__td--desc">
                            {row.shape} · {row.quality} · {row.color}
                            {row.size ? ` · ${row.size}` : ''}
                          </td>

                          {/* Jobs */}
                          <td className="bmw__td bmw__td--jobs">
                            {row.jobNos.length > 0
                              ? row.jobNos.map((j) => (
                                <span key={j} className="bmw__job-chip">{j}</span>
                              ))
                              : <span className="bmw__muted">—</span>
                            }
                          </td>

                          {/* Required */}
                          <td className="bmw__td bmw__td--num">{row.reqPcs}</td>
                          <td className="bmw__td bmw__td--num">{row.reqWt.toFixed(3)}</td>

                          {/* Entry + Available hint */}
                          <td className="bmw__td bmw__td--entry">
                            {isSaved
                              ? <span className="bmw__locked-val">{inp.pcs || '—'}</span>
                              : <div className="bmw__entry-cell">
                                <input
                                  type="number"
                                  className={`bmw__inp ${!bag ? 'bmw__inp--disabled' : ''}`}
                                  placeholder={bag ? String(row.reqPcs) : 'No bag'}
                                  disabled={!bag}
                                  value={inp.pcs}
                                  onChange={(e) => handleInput(row.rowKey, 'pcs', e.target.value)}
                                />
                                {bag && <span className="bmw__avl-hint">Avl: {bag.pcs}</span>}
                              </div>
                            }
                          </td>
                          <td className="bmw__td bmw__td--entry">
                            {isSaved
                              ? <span className="bmw__locked-val">{inp.cwt || '—'}</span>
                              : <div className="bmw__entry-cell">
                                <input
                                  type="number"
                                  step="0.001"
                                  className={`bmw__inp ${!bag ? 'bmw__inp--disabled' : ''}`}
                                  placeholder={bag ? row.reqWt.toFixed(3) : 'No bag'}
                                  disabled={!bag}
                                  value={inp.cwt}
                                  onChange={(e) => handleInput(row.rowKey, 'cwt', e.target.value)}
                                />
                                {bag && <span className="bmw__avl-hint">Avl: {Number(bag.wt).toFixed(3)}</span>}
                              </div>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Save / Return row */}
        <div className="bmw__save-row">
          {!isSaved ? (
            <Button variant="contained" size="small" startIcon={<Save size={12} />}
              className="bmw__save-btn" onClick={handleSaveAll}>
              Save All
            </Button>
          ) : (
            <Button variant="outlined" size="small" startIcon={<RotateCcw size={12} />}
              className="bmw__return-btn" onClick={() => setReturnModal(true)}>
              Return / Edit
            </Button>
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
            <span className="bmw-sidebar__stat-lbl">Required CWT</span>
          </div>
          <div className="bmw-sidebar__stat bmw-sidebar__stat--green">
            <span className="bmw-sidebar__stat-val">{totEntry.toFixed(3)}</span>
            <span className="bmw-sidebar__stat-lbl">Entry CWT</span>
          </div>
        </div>
        <div className="bmw-sidebar__groups">
          {Object.entries(grouped).map(([groupName, { item, rows: gRows }]) => {
            const gBagged = gRows.filter(r => r.matchedBag || r.manualBag).length;
            const gReq = gRows.reduce((a, r) => a + r.reqWt, 0);
            return (
              <div key={groupName} className="bmw-sidebar__group">
                <div className="bmw-sidebar__group-head">
                  <span style={{ color: matColor(item), display: 'flex' }}>{matIcon(item, 13)}</span>
                  <strong>{groupName}</strong>
                  <span className="bmw-sidebar__group-count">{gBagged}/{gRows.length}</span>
                </div>
                <div className="bmw-sidebar__group-detail">
                  <span>{gRows.length} specs</span>
                  <span>&middot;</span>
                  <span>{gReq.toFixed(3)} ct</span>
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
          scannedBags={scannedBags}
          onAddNewBag={handleAddNewBag}
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
