import React, { useState, useRef, useEffect } from 'react';
import {
  ScanLine, Save, CheckCircle2, AlertTriangle,
  PackageOpen, Package, Gem, Palette, Wrench, X, ChevronRight, RotateCcw, Pencil
} from 'lucide-react';
import Button from '@mui/material/Button';
import './SingleBulkEntry.scss';

// ─────────────────────────────────────────────────────────────

const SampleJobData = JSON.parse(sessionStorage.getItem("allJobListData"))
const SampleBagData = [];

const getMaterialIcon = (item) => {
  switch ((item || '').toUpperCase()) {
    case 'DIAMOND': return <Gem size={14} />;
    case 'COLORSTONE': return <Palette size={14} />;
    case 'FINDING':
    case 'MISC': return <Wrench size={14} />;
    default: return <Package size={14} />;
  }
};

const getMaterialColor = (item) => {
  switch ((item || '').toUpperCase()) {
    case 'DIAMOND': return '#e91e63';
    case 'COLORSTONE': return '#9c27b0';
    case 'FINDING':
    case 'MISC': return '#ff9800';
    default: return '#607d8b';
  }
};

// Material type → itemid filter
const MATERIAL_ITEMID_MAP = {
  all: null,   // no filter
  diamond: [3],
  colorstone: [4],
  misc: [5],
};

// 4C match
const find4CMatch = (jobLine, scannedBags) =>
  scannedBags.find(
    (bag) =>
      bag.itemid === jobLine.itemid &&
      (bag.shape || '').toUpperCase() === (jobLine.shape || '').toUpperCase() &&
      (bag.quality || '').toUpperCase() === (jobLine.Quality || '').toUpperCase() &&
      (bag.color_name || '').toUpperCase() === (jobLine.color || '').toUpperCase() &&
      (bag.size || '').toUpperCase() === (jobLine.size || '').toUpperCase()
  ) || null;

// Build rows — filtered by materialType, prefill issue qty from job required
const buildMaterialRows = (serialJobNo, materialType = 'all', scannedBags = []) => {
  const allowedItemIds = MATERIAL_ITEMID_MAP[materialType] ?? null;
  return SampleJobData
    .filter((d) => d.serialjobno === serialJobNo)
    .filter((d) => !allowedItemIds || allowedItemIds.includes(d.itemid))
    .map((line) => {
      const bag = find4CMatch(line, scannedBags);
      return {
        qid: line.qid,
        item: line.item,
        shape: line.shape,
        quality: line.Quality,
        color: line.color,
        size: line.size,
        requiredPcs: line.pcs,
        requiredWt: line.wt,
        matchedBag: bag ? { rfbag: bag.rfbag, availPcs: bag.pcs, availWt: bag.wt, supplier: bag.supplier } : null,
        assignedBag: bag ? bag.rfbag : null,
        pcs: bag ? String(line.pcs) : '',
        cwt: bag ? String(line.wt) : '',
      };
    });
};

const norm = (s) => String(s ?? '').trim().toUpperCase();

const convertRawBagToScanned = (rawBag) => ({
  id: rawBag.rfbag, label: rawBag.rfbag, rfbag: rawBag.rfbag,
  itemid: rawBag.itemid,
  type: rawBag.itemid === 3 ? 'Diamond' : rawBag.itemid === 4 ? 'Colorstone' : 'Finding / Misc',
  color: rawBag.itemid === 3 ? '#e91e63' : rawBag.itemid === 4 ? '#9c27b0' : '#ff9800',
  shape: rawBag.shape, quality: rawBag.Quality, size: rawBag.Size,
  wt: rawBag.wt, pcs: rawBag.pcs, supplier: rawBag.supplier,
  color_name: rawBag.color, shapeid: rawBag.shapeid,
});

// ─────────────────────────────────────────────────────────────
const SingleBulkEntry = ({ state, actions }) => {
  const [jobScanValue, setJobScanValue] = useState('');
  const [jobError, setJobError] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [bagScanValue, setBagScanValue] = useState('');
  const [bagScanError, setBagScanError] = useState('');
  const [activePendingIdx, setActivePendingIdx] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [saveFlash, setSaveFlash] = useState(false);

  const jobInputRef = useRef(null);
  const bagInputRef = useRef(null);

  useEffect(() => { jobInputRef.current?.focus(); }, []);

  const handleJobScan = () => {
    const val = jobScanValue.trim();
    if (!val) return;

    const existingSave = savedJobs.find((s) => s.jobId === val);
    if (existingSave) {
      // Re-open in locked mode with Return button
      setJobError('');
      setActiveJob({ id: val, locked: true });
      setMaterials(existingSave.materials);
      setActivePendingIdx(null);
      setBagScanValue('');
      setBagScanError('');
      setJobScanValue('');
      return;
    }

    const inScannedJobs = state.scannedJobs.some(
      (j) => j.id.toUpperCase() === val.toUpperCase()
    );
    if (!inScannedJobs) {
      setJobError(`"${val}" was not scanned on the Scan Jobs page.`);
      setJobScanValue('');
      return;
    }

    const hasLines = SampleJobData.some((d) => d.SerialJobNo === val);
    if (!hasLines) {
      setJobError(`Job "${val}" has no material data in the system.`);
      setJobScanValue('');
      return;
    }

    setJobError('');
    setActiveJob({ id: val });
    // ── Pass state.materialType so only selected material rows are shown ──
    setMaterials(buildMaterialRows(val, state.materialType, state?.scannedBags || []));
    setActivePendingIdx(null);
    setBagScanValue('');
    setBagScanError('');
    setJobScanValue('');
    setTimeout(() => bagInputRef.current?.focus(), 120);
  };

  const handleJobKeyDown = (e) => { if (e.key === 'Enter') handleJobScan(); else setJobError(''); };

  const handleSelectPending = (idx) => {
    setActivePendingIdx(idx);
    setBagScanError('');
    setTimeout(() => bagInputRef.current?.focus(), 80);
  };

  const handleBagScan = () => {
    const val = bagScanValue.trim();
    if (!val) return;
    if (activePendingIdx === null) { setBagScanError('Select a pending row first.'); return; }

    const scannedBags = state?.scannedBags || [];
    let bagRecord = scannedBags.find((b) => b.rfbag === val);
    if (!bagRecord) {
      const rawBag = SampleBagData.find((b) => norm(b.rfbag) === norm(val));
      if (rawBag) {
        bagRecord = convertRawBagToScanned(rawBag);
        actions?.addScannedBag?.(bagRecord);
      }
    }
    if (!bagRecord) { setBagScanError(`Bag "${val}" not found in system.`); setBagScanValue(''); return; }

    const alreadyUsed = materials.some((m, i) => i !== activePendingIdx && m.assignedBag === val);
    if (alreadyUsed) { setBagScanError(`Bag "${val}" already assigned to another row.`); setBagScanValue(''); return; }

    const row = materials[activePendingIdx];
    setBagScanError('');
    setMaterials((prev) =>
      prev.map((m, i) =>
        i === activePendingIdx
          ? {
            ...m,
            assignedBag: val,
            matchedBag: { rfbag: bagRecord.rfbag, availPcs: bagRecord.pcs, availWt: bagRecord.wt, supplier: bagRecord.supplier },
            pcs: String(row.requiredPcs),
            cwt: String(row.requiredWt),
          }
          : m
      )
    );
    setActivePendingIdx(null);
    setBagScanValue('');
    bagInputRef.current?.focus();
  };

  const handleBagKeyDown = (e) => { if (e.key === 'Enter') handleBagScan(); else setBagScanError(''); };

  const handleRemoveBag = (idx) => {
    setMaterials((prev) =>
      prev.map((m, i) => i === idx ? { ...m, assignedBag: null, matchedBag: null, pcs: '', cwt: '' } : m)
    );
    if (activePendingIdx === idx) setActivePendingIdx(null);
  };

  const handleFieldChange = (idx, field, value) => {
    if (activeJob?.locked) return;
    setMaterials((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleUnlock = () => {
    if (!activeJob) return;
    // Remove from savedJobs so it can be re-saved
    setSavedJobs((prev) => prev.filter((s) => s.jobId !== activeJob.id));
    setActiveJob({ id: activeJob.id });
  };

  const handleSaveJob = () => {
    if (!activeJob) return;
    const entries = materials.map((m) => ({
      qid: m.qid, item: m.item, shape: m.shape, quality: m.quality,
      color: m.color, size: m.size, assignedBag: m.assignedBag,
      pcs: parseFloat(m.pcs) || 0, cwt: parseFloat(m.cwt) || 0,
    }));
    if (actions?.updateJobEntry) actions.updateJobEntry(activeJob.id, { bags: entries });
    setSavedJobs((prev) => [...prev, { jobId: activeJob.id, materials: [...materials] }]);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 700);
    setActiveJob(null);
    setMaterials([]);
    setActivePendingIdx(null);
    setBagScanValue('');
    setBagScanError('');
    setTimeout(() => jobInputRef.current?.focus(), 120);
  };

  const assignedCount = materials.filter((m) => m.assignedBag).length;
  const pendingCount = materials.length - assignedCount;

  // ── Material type label for display ──────────────────────────
  const matLabel = {
    all: 'All Materials',
    diamond: 'Diamond only',
    colorstone: 'Colorstone only',
    misc: 'Misc / Findings only',
  }[state.materialType] || 'All Materials';

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
      <div className="sbe-wrap">
        {/* ── Job scan bar ── */}
        <div className="sbe-topbar">
          <div className="sbe-topbar__row">
            <ScanLine size={16} className="sbe-topbar__icon" />
            <input
              ref={jobInputRef}
              type="text"
              className={`sbe-input ${jobError ? 'sbe-input--error' : ''}`}
              value={jobScanValue}
              onChange={(e) => { setJobScanValue(e.target.value); setJobError(''); }}
              onKeyDown={handleJobKeyDown}
              placeholder="Scan job barcode (must be from Scan Jobs page)..."
              disabled={!!activeJob}
            />
            <Button variant="contained" size="small" onClick={handleJobScan}
              disabled={!!activeJob || !jobScanValue.trim()} className="sbe-btn-primary">
              Add Job
            </Button>
            {/* Material type indicator */}
            <span className="sbe-mat-badge">{matLabel}</span>
          </div>
          {jobError && <div className="sbe-error"><AlertTriangle size={13} /> {jobError}</div>}
        </div>

        {/* ── Empty state ── */}
        {!activeJob && savedJobs.length === 0 && (
          <div className="sbe-empty">
            <ScanLine size={38} />
            <h3>Scan a Job</h3>
            <p>Showing <strong>{matLabel}</strong> rows only</p>
          </div>
        )}

        {/* ── Active job card ── */}
        {activeJob && (
          <div className="sbe-card">

            {/* Card header */}
            <div className="sbe-card__head">
              <div className="sbe-card__title">
                <PackageOpen size={17} />
                <span>Job: <strong>{activeJob.id}</strong></span>
              </div>
              <div className="sbe-card__badges">
                <span className="sbe-badge sbe-badge--blue">{matLabel}</span>
                <span className="sbe-badge sbe-badge--green"><CheckCircle2 size={12} /> {assignedCount} assigned</span>
                {pendingCount > 0 && <span className="sbe-badge sbe-badge--amber"><AlertTriangle size={12} /> {pendingCount} pending</span>}
              </div>
            </div>

            {/* Bag scan bar */}
            {pendingCount > 0 && (
              <div className="sbe-bag-bar">
                <span className="sbe-bag-bar__hint">
                  {activePendingIdx !== null
                    ? <><ScanLine size={12} /> Row #{activePendingIdx + 1} selected — scan bag now</>
                    : <>Click a pending row ↓ then scan its bag here</>
                  }
                </span>
                <div className="sbe-bag-bar__row">
                  <input
                    ref={bagInputRef}
                    type="text"
                    className={`sbe-input sbe-input--sm ${bagScanError ? 'sbe-input--error' : ''} ${activePendingIdx === null ? 'sbe-input--dim' : ''}`}
                    value={bagScanValue}
                    onChange={(e) => { setBagScanValue(e.target.value); setBagScanError(''); }}
                    onKeyDown={handleBagKeyDown}
                    placeholder={activePendingIdx !== null ? 'Scan bag barcode...' : 'Select a pending row first...'}
                    disabled={activePendingIdx === null}
                  />
                  <Button variant="outlined" size="small" onClick={handleBagScan}
                    disabled={activePendingIdx === null || !bagScanValue.trim()}
                    className="sbe-btn-assign">
                    Assign
                  </Button>
                </div>
                {bagScanError && <div className="sbe-error"><AlertTriangle size={12} /> {bagScanError}</div>}
              </div>
            )}

            {/* ── Table ── */}
            <div className="sbe-table">
              <div className="sbe-table__head">
                <span className="sbe-col sbe-col--no">#</span>
                <span className="sbe-col sbe-col--item">Item</span>
                <span className="sbe-col sbe-col--spec">Spec</span>
                <span className="sbe-col sbe-col--bag">Bag No.</span>
                <span className="sbe-col sbe-col--req">Req. PCS</span>
                <span className="sbe-col sbe-col--req">Req. CWT</span>
                <span className="sbe-col sbe-col--issue">Issue PCS</span>
                <span className="sbe-col sbe-col--issue">Issue CWT</span>
              </div>

              <div className="sbe-table__body">
                {materials.length === 0 ? (
                  <div className="sbe-table__empty">
                    No {matLabel} rows found for this job.
                  </div>
                ) : (
                  materials.map((mat, idx) => {
                    const has = !!mat.assignedBag;
                    const isPend = activePendingIdx === idx;
                    return (
                      <div
                        key={mat.qid}
                        className={[
                          'sbe-table__row',
                          has ? 'sbe-table__row--ok' : 'sbe-table__row--pend',
                          isPend ? 'sbe-table__row--sel' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => !has && handleSelectPending(idx)}
                      >
                        <span className="sbe-col sbe-col--no sbe-idx">{idx + 1}</span>

                        <span className="sbe-col sbe-col--item sbe-item-cell"
                          style={{ '--ic': getMaterialColor(mat.item) }}>
                          {getMaterialIcon(mat.item)}
                          <span>{mat.item}</span>
                        </span>

                        <span className="sbe-col sbe-col--spec">
                          <span className="sbe-pills">
                            <span className="sbe-pill">{mat.shape}</span>
                            <span className="sbe-pill">{mat.quality}</span>
                            <span className="sbe-pill">{mat.color}</span>
                            <span className="sbe-pill">{mat.size}</span>
                          </span>
                        </span>

                        <span className="sbe-col sbe-col--bag">
                          {has ? (
                            <span className="sbe-bag-ok">
                              <CheckCircle2 size={12} />
                              <span className="sbe-bag-ok__no">{mat.assignedBag}</span>
                              <button className="sbe-bag-ok__x"
                                onClick={(e) => { e.stopPropagation(); handleRemoveBag(idx); }}>
                                <X size={10} />
                              </button>
                            </span>
                          ) : (
                            <span className={`sbe-bag-none ${isPend ? 'sbe-bag-none--sel' : ''}`}>
                              {isPend ? <><ScanLine size={11} /> Scan now</> : <><ChevronRight size={11} /> Select</>}
                            </span>
                          )}
                        </span>
                        <span className="sbe-col sbe-col--req sbe-req">{mat.requiredPcs}</span>
                        <span className="sbe-col sbe-col--req sbe-req">{mat.requiredWt}</span>

                        <span className="sbe-col sbe-col--issue" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
                          {activeJob?.locked
                            ? <span className="sbe-locked-val">{mat.pcs || '—'}</span>
                            : <input type="number"
                              className={`sbe-num ${!has ? 'sbe-num--off' : ''}`}
                              value={mat.pcs}
                              onChange={(e) => handleFieldChange(idx, 'pcs', e.target.value)}
                              placeholder="PCS" disabled={!has} />
                          }
                          <p style={{ display: 'flex', padding: '0 7px', width: '100%' }}>
                            {has && mat.matchedBag ? `Avl: ${mat.matchedBag.availPcs}` : <span className="sbe-dash">—</span>}
                          </p>
                        </span>
                        <span className="sbe-col sbe-col--issue" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
                          {activeJob?.locked
                            ? <span className="sbe-locked-val">{mat.cwt || '—'}</span>
                            : <input type="number" step="0.001"
                              className={`sbe-num ${!has ? 'sbe-num--off' : ''}`}
                              value={mat.cwt}
                              onChange={(e) => handleFieldChange(idx, 'cwt', e.target.value)}
                              placeholder="CWT" disabled={!has} />
                          }
                          <p style={{ display: 'flex', padding: '0 7px', width: '100%' }}>
                            {has && mat.matchedBag ? `Avl: ${mat.matchedBag.availWt}` : <span className="sbe-dash">—</span>}
                          </p>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Save bar */}
            <div className="sbe-save-bar">
              <span className={pendingCount > 0 ? 'sbe-save-bar__warn' : 'sbe-save-bar__ok'}>
                {pendingCount > 0
                  ? <><AlertTriangle size={13} /> {pendingCount} row{pendingCount !== 1 ? 's' : ''} still need a bag</>
                  : <><CheckCircle2 size={13} /> All bags assigned</>
                }
              </span>
              {activeJob?.locked ? (
                <Button
                  variant="outlined"
                  onClick={handleUnlock}
                  startIcon={<RotateCcw size={15} />}
                  className="sbe-btn-return"
                >
                  Return / Edit
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleSaveJob}
                  startIcon={<Save size={15} />}
                  className={`sbe-btn-save ${saveFlash ? 'sbe-btn-save--flash' : ''}`}
                >
                  Save Job &amp; Add Next
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* ── Saved jobs ── */}
      {savedJobs.length > 0 && (
        <div className="sbe-saved">
          <div className="sbe-saved__title"><CheckCircle2 size={14} /> Saved Jobs ({savedJobs.length})</div>
          {savedJobs.map((sj, i) => {
            const a = sj.materials.filter((m) => m.assignedBag).length;
            const n = sj.materials.length - a;
            return (
              <div key={i} className="sbe-saved__job">
                <div className="sbe-saved__job-head">
                  <strong>{sj.jobId}</strong>
                  <span className="sbe-saved__meta">
                    {sj.materials.length} rows · {a} bags
                    {n > 0 && <span className="sbe-saved__no-bag-pill">{n} no bag</span>}
                  </span>
                </div>
                <div className="sbe-saved__chips">
                  {sj.materials.map((m) => (
                    <div key={m.qid} className={`sbe-saved__chip ${!m.assignedBag ? 'sbe-saved__chip--warn' : ''}`}>
                      <span style={{ color: getMaterialColor(m.item), display: 'flex' }}>{getMaterialIcon(m.item)}</span>
                      <span className="sbe-saved__spec">{m.shape} · {m.quality} · {m.color} · {m.size}</span>
                      {m.assignedBag
                        ? <span className="sbe-saved__bag">{m.assignedBag}</span>
                        : <span className="sbe-saved__nobag">No bag</span>
                      }
                      <span className="sbe-saved__vals">{m.pcs || '—'} / {m.cwt || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SingleBulkEntry;