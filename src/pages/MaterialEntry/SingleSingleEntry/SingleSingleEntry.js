import React, { useState, useRef, useEffect } from 'react';
import {
  ScanLine, Save, PackageOpen, CheckCircle2,
  Gem, Palette, Wrench, Package, AlertCircle, Pencil, X, RotateCcw, PackagePlus
} from 'lucide-react';
import Button from '@mui/material/Button';
import './SingleSingleEntry.scss';

// ─────────────────────────────────────────────────────────────
// sessionStorage helpers
// ─────────────────────────────────────────────────────────────
const getSession = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const ScannedJobList   = getSession('scannedJobListData');
const ScannedMaterials = getSession('scannedJobMaterialData');
const ScannedBags      = getSession('scannedBagData');
const AllBagListData   = getSession('allBagListData');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').trim().toUpperCase();

const getItemLabel = (itemid) => {
  switch (itemid) {
    case 3:  return 'Diamond';
    case 4:  return 'Colorstone';
    case 5:  return 'Finding / Misc';
    default: return 'Unknown';
  }
};

const getMaterialIcon = (itemid, size = 16) => {
  switch (itemid) {
    case 3:  return <Gem     size={size} />;
    case 4:  return <Palette size={size} />;
    case 5:  return <Wrench  size={size} />;
    default: return <Package size={size} />;
  }
};

const getMaterialColor = (itemid) => {
  switch (itemid) {
    case 3:  return '#e91e63';
    case 4:  return '#9c27b0';
    case 5:  return '#ff9800';
    default: return '#607d8b';
  }
};

// ─────────────────────────────────────────────────────────────
// getMaterialLinesForJob
// Returns all scannedJobMaterialData rows for a given SerialJobNo
// Each row = one required material line (shape+quality+color+size+wt+pcs)
// ─────────────────────────────────────────────────────────────
const getMaterialLinesForJob = (serialJobNo) =>
  ScannedMaterials.filter(
    (m) => norm(m.SerialJobNo) === norm(serialJobNo)
  ).map((m) => ({
    // unique key for this material line
    lineKey:   `${m.qid}_${m.jid}`,
    qid:       m.qid,
    jid:       m.jid,
    SerialJobNo: m.SerialJobNo,
    QuotationNo: m.QuotationNo,
    itemid:    m.itemid,
    material:  getItemLabel(m.itemid),
    shape:     m.shape     || '',
    quality:   m.Quality   || '',
    color:     m.color     || '',
    size:      m.size      || m.customsize || '',
    findingtypename:    m.findingtypename    || '',
    findingAccessories: m.findingAccessories || '',
    reqPcs:    m.pcs ?? 0,
    reqWt:     m.wt  ?? 0,
    // assigned bag rfbag (null until user scans)
    assignedBag: null,
  }));

// ─────────────────────────────────────────────────────────────
// tryAutoMatch
// For a material line, find a matching bag in scannedBagData
// Returns the bag object or null
// ─────────────────────────────────────────────────────────────
const tryAutoMatch = (material) => {
  const isFinding = material.itemid === 5;
  return ScannedBags.find((bag) => {
    if (bag.itemid !== material.itemid) return false;
    if (isFinding) {
      return (
        norm(bag.findingtypename    || '') === norm(material.findingtypename)    &&
        norm(bag.findingAccessories || '') === norm(material.findingAccessories)
      );
    }
    return (
      norm(bag.shape)      === norm(material.shape)   &&
      norm(bag.quality)    === norm(material.quality)  &&
      norm(bag.color_name || bag.color || '') === norm(material.color) &&
      norm(bag.size)       === norm(material.size)
    );
  }) ?? null;
};

// ─────────────────────────────────────────────────────────────
// lookupBagFromPool — scannedBagData first, then allBagListData
// ─────────────────────────────────────────────────────────────
const lookupBagFromPool = (rfbagVal) => {
  const inScanned = ScannedBags.find(
    (b) => norm(b.rfbag) === norm(rfbagVal) || norm(b.rfbag).endsWith(norm(rfbagVal))
  );
  if (inScanned) return inScanned;

  const inAll = AllBagListData.find(
    (b) => norm(b.rfbag) === norm(rfbagVal) || norm(b.rfbag).endsWith(norm(rfbagVal))
  );
  if (inAll) {
    return {
      rfbag:      inAll.rfbag,
      itemid:     inAll.itemid,
      shape:      inAll.shape,
      quality:    inAll.Quality,
      size:       inAll.Size,
      color_name: inAll.color,
      remwt:      inAll.remwt  ?? inAll.wt  ?? 0,
      rempcs:     inAll.rempcs ?? inAll.pcs ?? 0,
      LockerName: inAll.LockerName || '',
      iscompany:  inAll.iscompany,
      istoreCust_CustName: inAll.istoreCust_CustName || '',
      findingtypename:    inAll.findingtypename    || '',
      findingAccessories: inAll.findingAccessories || '',
    };
  }
  return null;
};

console.log('ScannedJobList: ', ScannedJobList);
const isValidScannedJob = (val) =>
  ScannedJobList.some((j) => norm(j.serialjobno) === norm(val));

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const SingleSingleEntry = ({ state, actions }) => {
  const [phase, setPhase]               = useState('scan-job');
  const [jobScanValue, setJobScanValue] = useState('');
  const [jobError, setJobError]         = useState('');

  const [activeJob, setActiveJob]       = useState(null);

  // materialLines[]: the LEFT PANEL — one row per material spec
  // shape: { lineKey, qid, jid, itemid, material, shape, quality, color, size,
  //          reqPcs, reqWt, assignedBag: null | bagObject,
  //          entry: null | { pcs, wt } }
  const [materialLines, setMaterialLines] = useState([]);

  // which material line is currently being worked on (lineKey)
  const [activeLineKey, setActiveLineKey] = useState(null);

  // scan input for assigning a bag to the active line
  const [assignScanValue, setAssignScanValue] = useState('');
  const [assignError, setAssignError]         = useState('');

  // data entry values
  const [pcsValue, setPcsValue] = useState('');
  const [wtValue,  setWtValue]  = useState('');

  const [editingLineKey, setEditingLineKey] = useState(null);
  const [completedJobs, setCompletedJobs]   = useState([]);
  const [showSaveAnim, setShowSaveAnim]     = useState(false);

  const jobInputRef    = useRef(null);
  const assignInputRef = useRef(null);
  const pcsInputRef    = useRef(null);

  // ── Focus ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'scan-job')    setTimeout(() => jobInputRef.current?.focus(),    80);
    if (phase === 'assign-bag')  setTimeout(() => assignInputRef.current?.focus(), 80);
    if (phase === 'enter-data')  setTimeout(() => pcsInputRef.current?.focus(),    80);
  }, [phase]);

  // ── Derived ───────────────────────────────────────────────
  const totalLines  = materialLines.length;
  const savedLines  = materialLines.filter((l) => l.entry !== null && l.entry !== undefined).length;
  const progress    = totalLines > 0 ? Math.round((savedLines / totalLines) * 100) : 0;
  const activeLine  = materialLines.find((l) => l.lineKey === activeLineKey) ?? null;

  const activeJobQuotation = activeJob
    ? (ScannedMaterials.find(
        (m) => norm(m.SerialJobNo) === norm(activeJob.id)
      )?.QuotationNo ?? '')
    : '';

  // ── Job Scan ───────────────────────────────────────────────
  const handleJobScan = () => {
    const val = jobScanValue.trim();
    if (!val) return;
    setJobError('');

    if (!isValidScannedJob(val)) {
      setJobError(`Job "${val}" was not scanned in Step 4.`);
      setJobScanValue('');
      return;
    }

    // Already completed — re-open locked
    if (completedJobs.includes(norm(val))) {
      const lines = getMaterialLinesForJob(val);
      const jobEntry = state.jobEntries?.[norm(val)];
      // Restore saved entries
      const restored = lines.map((line) => {
        const saved = jobEntry?.bags?.find((b) => b.lineKey === line.lineKey);
        return {
          ...line,
          assignedBag: saved?.bag ?? null,
          entry: saved ? { pcs: saved.pcs, wt: saved.wt } : null,
        };
      });
      setActiveJob({ id: val, locked: true });
      setMaterialLines(restored);
      setActiveLineKey(null);
      setJobScanValue('');
      setPhase('job-done');
      return;
    }

    // Fresh job — build material lines
    const lines = getMaterialLinesForJob(val);

    // Auto-match bags where possible
    const withAutoMatch = lines.map((line) => {
      const matched = tryAutoMatch(line);
      return {
        ...line,
        assignedBag: matched
          ? {
              rfbag:    matched.rfbag,
              itemid:   matched.itemid,
              shape:    matched.shape,
              quality:  matched.quality,
              size:     matched.size,
              color_name: matched.color_name || matched.color || '',
              LockerName: matched.LockerName || '',
              stockPcs:   matched.rempcs ?? matched.pcs ?? 0,
              stockWt:    matched.remwt  ?? matched.wt  ?? 0,
            }
          : null,
        entry: null,
      };
    });

    setActiveJob({ id: val, locked: false });
    setMaterialLines(withAutoMatch);
    setActiveLineKey(null);
    setAssignScanValue('');
    setAssignError('');
    setJobScanValue('');

    // Go straight to first unassigned line
    const firstUnassigned = withAutoMatch.find((l) => !l.assignedBag);
    if (firstUnassigned) {
      setActiveLineKey(firstUnassigned.lineKey);
      setPhase('assign-bag');
    } else {
      // All auto-matched — go to first line for data entry
      setActiveLineKey(withAutoMatch[0]?.lineKey ?? null);
      prefillEntry(withAutoMatch[0]);
      setPhase('enter-data');
    }
  };

  // ── Pre-fill entry fields from a line ─────────────────────
  const prefillEntry = (line, fromEdit = false) => {
    if (!line) return;
    if (fromEdit && line.entry) {
      setPcsValue(String(line.entry.pcs ?? ''));
      setWtValue (String(line.entry.wt  ?? ''));
    } else {
      setPcsValue(line.reqPcs != null && line.reqPcs !== 0 ? String(line.reqPcs) : '');
      setWtValue (line.reqWt  != null && line.reqWt  !== 0 ? String(line.reqWt)  : '');
    }
  };

  // ── Click a material line row ──────────────────────────────
  const handleLineClick = (line) => {
    if (activeJob?.locked) return;

    setActiveLineKey(line.lineKey);
    setAssignError('');
    setAssignScanValue('');

    if (!line.assignedBag) {
      // Need to assign a bag first
      setPhase('assign-bag');
    } else if (line.entry) {
      // Already has entry — go to edit
      setEditingLineKey(line.lineKey);
      prefillEntry(line, true);
      setPhase('enter-data');
    } else {
      // Bag assigned, no entry yet
      prefillEntry(line, false);
      setPhase('enter-data');
    }
  };

  // ── Assign bag to active material line ────────────────────
  const handleAssignBag = () => {
    const val = assignScanValue.trim();
    if (!val || !activeLine) return;
    setAssignError('');

    const rawBag = lookupBagFromPool(val);
    if (!rawBag) {
      setAssignError(`Bag "${val}" not found in locker data.`);
      setAssignScanValue('');
      assignInputRef.current?.focus();
      return;
    }

    const bagObj = {
      rfbag:      rawBag.rfbag,
      itemid:     rawBag.itemid,
      shape:      rawBag.shape,
      quality:    rawBag.quality || rawBag.Quality || '',
      size:       rawBag.size    || rawBag.Size    || '',
      color_name: rawBag.color_name || rawBag.color || '',
      LockerName: rawBag.LockerName || '',
      stockPcs:   rawBag.rempcs ?? rawBag.pcs ?? 0,
      stockWt:    rawBag.remwt  ?? rawBag.wt  ?? 0,
    };

    // Assign bag to this line
    setMaterialLines((prev) =>
      prev.map((l) =>
        l.lineKey === activeLine.lineKey ? { ...l, assignedBag: bagObj } : l
      )
    );

    setAssignScanValue('');

    // Move to data entry for this line
    prefillEntry({ ...activeLine, assignedBag: bagObj }, false);
    setPhase('enter-data');
  };

  // ── Save entry for active line ────────────────────────────
  const handleSave = () => {
    if (!activeLine || !pcsValue || !wtValue) return;

    const entry = { pcs: parseFloat(pcsValue), wt: parseFloat(wtValue) };

    const updatedLines = materialLines.map((l) =>
      l.lineKey === activeLine.lineKey ? { ...l, entry } : l
    );
    setMaterialLines(updatedLines);

    // Push to context
    const existing    = state.jobEntries?.[activeJob.id]?.bags || [];
    const updatedBags = existing.filter((b) => b.lineKey !== activeLine.lineKey);
    actions.updateJobEntry(activeJob.id, {
      bags: [...updatedBags, {
        lineKey: activeLine.lineKey,
        bag:     activeLine.assignedBag,
        rfbag:   activeLine.assignedBag?.rfbag,
        ...entry,
      }],
    });

    setShowSaveAnim(true);
    setTimeout(() => setShowSaveAnim(false), 700);

    setEditingLineKey(null);
    setPcsValue('');
    setWtValue('');

    // Move to next unsaved line
    const savedCount = updatedLines.filter((l) => l.entry !== null && l.entry !== undefined).length;
    if (savedCount >= updatedLines.length) {
      setActiveLineKey(null);
      setPhase('job-done');
      return;
    }

    // Find next line without entry
    const nextLine = updatedLines.find((l) => !l.entry);
    if (nextLine) {
      setActiveLineKey(nextLine.lineKey);
      setAssignScanValue('');
      setAssignError('');
      if (!nextLine.assignedBag) {
        setPhase('assign-bag');
      } else {
        prefillEntry(nextLine, false);
        setPhase('enter-data');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingLineKey(null);
    setPcsValue('');
    setWtValue('');
    const savedCount = materialLines.filter((l) => l.entry).length;
    setPhase(savedCount >= totalLines ? 'job-done' : 'assign-bag');
  };

  const handleFinishJob = () => {
    setCompletedJobs((prev) => [...prev, norm(activeJob.id)]);
    setActiveJob(null);
    setMaterialLines([]);
    setActiveLineKey(null);
    setEditingLineKey(null);
    setPcsValue('');
    setWtValue('');
    setPhase('scan-job');
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="sse-root">

      {/* ══ PHASE: SCAN JOB ══ */}
      {phase === 'scan-job' && (
        <div className="sse-scan-prompt">
          <div className="sse-scan-card">
            <div className="sse-scan-card__icon"><ScanLine size={44} /></div>
            <h2>Scan Job</h2>
            <p>Scan a job barcode to begin material entry</p>
            <div className="sse-scan-card__row">
              <input
                ref={jobInputRef}
                type="text"
                className="sse-input"
                value={jobScanValue}
                onChange={(e) => { setJobScanValue(e.target.value); setJobError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJobScan()}
                placeholder="Scan job barcode..."
              />
              <Button
                variant="contained"
                onClick={handleJobScan}
                className="sse-btn-scan"
                disabled={!jobScanValue.trim()}
              >
                Scan
              </Button>
            </div>
            {jobError && (
              <div className="sse-error">
                <AlertCircle size={15} /><span>{jobError}</span>
              </div>
            )}
            {ScannedJobList.length > 0 && (
              <div className="sse-scan-card__hint">
                {ScannedJobList.length} job{ScannedJobList.length !== 1 ? 's' : ''} available from Step 4
              </div>
            )}
          </div>

          {completedJobs.length > 0 && (
            <div className="sse-completed">
              <div className="sse-completed__title">
                <CheckCircle2 size={15} /> Completed Jobs ({completedJobs.length})
              </div>
              <div className="sse-completed__chips">
                {completedJobs.map((id) => (
                  <span key={id} className="sse-completed__chip">{id}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PHASES: assign-bag | enter-data | job-done ══ */}
      {(phase === 'assign-bag' || phase === 'enter-data' || phase === 'job-done') && activeJob && (
        <div className="sse-job-layout">

          {/* ── Job bar ── */}
          <div className="sse-job-bar">
            <div className="sse-job-bar__left">
              <PackageOpen size={18} />
              <span>Job:</span>
              <strong>{activeJob.id}</strong>
              {activeJobQuotation && (
                <span className="sse-job-bar__quote">{activeJobQuotation}</span>
              )}
            </div>
            <div className="sse-job-bar__right">
              <span className="sse-job-bar__progress-text">
                {savedLines}/{totalLines} materials
              </span>
              <div className="sse-job-bar__track">
                <div className="sse-job-bar__fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="sse-job-bar__pct">{progress}%</span>
            </div>
          </div>

          <div className="sse-columns">

            {/* ════════════════════════════════════════
                LEFT: Material Lines (always all shown)
            ════════════════════════════════════════ */}
            <div className="sse-bags-panel">
              <div className="sse-bags-panel__header">
                <span>Materials</span>
                <span className="sse-bags-panel__count">{savedLines}/{totalLines}</span>
              </div>

              {materialLines.length === 0 ? (
                <div className="sse-bags-empty">
                  <Package size={28} />
                  <span>No material lines found for this job.</span>
                </div>
              ) : (
                <div className="sse-bags-list">
                  {materialLines.map((line) => {
                    console.log('line: ', line);
                    const isSaved   = !!line.entry;
                    const isActive  = line.lineKey === activeLineKey;
                    const hasBAg    = !!line.assignedBag;

                    return (
                      <div
                        key={line.lineKey}
                        className={[
                          'sse-bag-row',
                          isSaved  ? 'sse-bag-row--saved'  : '',
                          isActive ? 'sse-bag-row--active' : '',
                          !hasBAg  ? 'sse-bag-row--unassigned' : '',
                        ].join(' ')}
                        onClick={() => !activeJob.locked && handleLineClick(line)}
                        style={{ cursor: activeJob.locked ? 'default' : 'pointer' }}
                      >
                        {/* Icon */}
                        <div
                          className="sse-bag-row__icon"
                          style={{ color: isSaved ? '#22c55e' : getMaterialColor(line.itemid) }}
                        >
                          {isSaved
                            ? <CheckCircle2 size={18} />
                            : getMaterialIcon(line.itemid, 18)}
                        </div>

                        {/* Material spec */}
                        <div className="sse-bag-row__info">
                          <span className="sse-bag-row__rfbag">
                            {line.shape} · {line.quality} · {line.color} · {line.size}
                          </span>
                          <span className="sse-bag-row__desc">{line.material}</span>

                          {/* Assigned bag info */}
                          {hasBAg ? (
                            <span className="sse-bag-row__stock">
                              Bag: {line.assignedBag.rfbag}
                              {line.assignedBag.LockerName
                                ? ` · ${line.assignedBag.LockerName}`
                                : ''}
                            </span>
                          ) : (
                            <span className="sse-bag-row__stock sse-bag-row__stock--warn">
                              No bag assigned — scan to assign
                            </span>
                          )}
                        </div>

                        {/* Required + Entered */}
                        <div className="sse-bag-row__req">
                          <div className="sse-bag-row__req-row">
                            <span className="sse-bag-row__req-label">Req</span>
                            <span className="sse-bag-row__req-val">{line.reqPcs} pcs /</span>
                            <span className="sse-bag-row__req-val">{line.reqWt} ct</span>
                          </div>
                          {isSaved && (
                            <div className="sse-bag-row__entered-row">
                              <span className="sse-bag-row__entered-label">✓</span>
                              <span className="sse-bag-row__entered-val">{line.entry.pcs} pcs</span>
                              <span className="sse-bag-row__entered-val">{line.entry.wt} ct</span>
                            </div>
                          )}
                        </div>

                        {/* Action badge */}
                        <div className="sse-bag-row__actions">
                          {isActive && (
                            <span className="sse-bag-row__badge sse-bag-row__badge--active">
                              Active
                            </span>
                          )}
                          {isSaved && !isActive && (
                            <button
                              className="sse-bag-row__edit-btn"
                              onClick={(e) => { e.stopPropagation(); handleLineClick(line); }}
                            >
                              <Pencil size={13} /> Edit
                            </button>
                          )}
                          {!isSaved && !isActive && !hasBAg && (
                            <span className="sse-bag-row__badge sse-bag-row__badge--warn">
                              Assign
                            </span>
                          )}
                          {!isSaved && !isActive && hasBAg && (
                            <span className="sse-bag-row__badge sse-bag-row__badge--pending">
                              Enter
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════
                RIGHT: Assign bag / Enter data / Done
            ════════════════════════════════════════ */}
            <div className="sse-entry-panel">

              {/* ── ASSIGN BAG ── */}
              {phase === 'assign-bag' && activeLine && (
                <div className="sse-scan-card sse-scan-card--compact">
                  {/* Material spec this bag will be assigned to */}
                  <div className="sse-assign-header">
                    <div
                      className="sse-assign-header__icon"
                      style={{ color: getMaterialColor(activeLine.itemid) }}
                    >
                      {getMaterialIcon(activeLine.itemid, 20)}
                    </div>
                    <div className="sse-assign-header__info">
                      <strong>Assign Bag for:</strong>
                      <span>
                        {activeLine.material} · {activeLine.shape} · {activeLine.quality} · {activeLine.color} · {activeLine.size}
                      </span>
                      <span className="sse-assign-header__req">
                        Req: {activeLine.reqPcs} pcs / {activeLine.reqWt} ct
                      </span>
                    </div>
                  </div>

                  <div className="sse-scan-card__icon sse-scan-card__icon--sm" style={{ marginTop: 16 }}>
                    <PackagePlus size={30} />
                  </div>
                  <h3>Scan Bag to Assign</h3>
                  <p>Scan a bag barcode to assign it to this material line</p>

                  <div className="sse-scan-card__row">
                    <input
                      ref={assignInputRef}
                      type="text"
                      className="sse-input"
                      value={assignScanValue}
                      onChange={(e) => { setAssignScanValue(e.target.value); setAssignError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAssignBag()}
                      placeholder="e.g. 0000002988"
                    />
                    <Button
                      variant="contained"
                      onClick={handleAssignBag}
                      disabled={!assignScanValue.trim()}
                      className="sse-btn-scan"
                    >
                      Assign
                    </Button>
                  </div>

                  {assignError && (
                    <div className="sse-error">
                      <AlertCircle size={14} /><span>{assignError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── ENTER DATA ── */}
              {phase === 'enter-data' && activeLine && (
                <div className="sse-data-card">
                  <div className="sse-data-card__header">
                    <div
                      className="sse-data-card__icon"
                      style={{ color: getMaterialColor(activeLine.itemid) }}
                    >
                      {getMaterialIcon(activeLine.itemid, 22)}
                    </div>
                    <div className="sse-data-card__header-text">
                      <strong>
                        {activeLine.assignedBag?.rfbag ?? '—'}
                      </strong>
                      <span>
                        {activeLine.material} · {activeLine.shape} · {activeLine.quality} · {activeLine.size}
                      </span>
                      {activeLine.assignedBag?.LockerName && (
                        <span className="sse-data-card__locker">
                          {activeLine.assignedBag.LockerName}
                        </span>
                      )}
                    </div>
                    {editingLineKey && (
                      <button className="sse-data-card__close" onClick={handleCancelEdit}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Stock info */}
                  {activeLine.assignedBag && (
                    <div className="sse-data-card__stock-row">
                      <span className="sse-data-card__req-label">Stock:</span>
                      <span className="sse-data-card__req-val">
                        {activeLine.assignedBag.stockPcs} pcs
                      </span>
                      <span className="sse-data-card__req-sep">/</span>
                      <span className="sse-data-card__req-val">
                        {activeLine.assignedBag.stockWt} ct
                      </span>
                    </div>
                  )}

                  <div className="sse-data-card__req-row">
                    <span className="sse-data-card__req-label">Required:</span>
                    <span className="sse-data-card__req-val">{activeLine.reqPcs} pcs</span>
                    <span className="sse-data-card__req-sep">/</span>
                    <span className="sse-data-card__req-val">{activeLine.reqWt} ct</span>
                  </div>

                  <div className="sse-data-card__fields">
                    <div className="sse-field">
                      <label>PCS</label>
                      <input
                        ref={pcsInputRef}
                        type="number"
                        className="sse-input"
                        value={pcsValue}
                        onChange={(e) => setPcsValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            document.getElementById('sse-wt-input')?.focus();
                        }}
                        placeholder="Enter PCS"
                      />
                    </div>
                    <div className="sse-field">
                      <label>WT (ct)</label>
                      <input
                        id="sse-wt-input"
                        type="number"
                        step="0.001"
                        className="sse-input"
                        value={wtValue}
                        onChange={(e) => setWtValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                        placeholder="Enter WT"
                      />
                    </div>
                  </div>

                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!pcsValue || !wtValue}
                    startIcon={<Save size={15} />}
                    className={`sse-btn-save ${showSaveAnim ? 'sse-btn-save--flash' : ''}`}
                    fullWidth
                  >
                    {editingLineKey ? 'Update Entry' : 'Save & Next'}
                  </Button>
                </div>
              )}

              {/* ── JOB DONE ── */}
              {phase === 'job-done' && (
                <div className="sse-job-done">
                  <div className="sse-job-done__icon"><CheckCircle2 size={44} /></div>
                  <h2>{activeJob?.locked ? 'Job Previously Saved' : 'All Materials Done!'}</h2>
                  <p>
                    {savedLines} material{savedLines !== 1 ? 's' : ''} saved for job{' '}
                    <strong>{activeJob.id}</strong>
                  </p>
                  {activeJob?.locked ? (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCompletedJobs((prev) => prev.filter((id) => id !== norm(activeJob.id)));
                        setActiveJob({ ...activeJob, locked: false });
                        setPhase(savedLines >= totalLines ? 'job-done' : 'assign-bag');
                      }}
                      startIcon={<RotateCcw size={16} />}
                      className="sse-btn-return"
                    >
                      Return / Edit
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleFinishJob}
                      startIcon={<Save size={16} />}
                      className="sse-btn-finish"
                    >
                      Save &amp; Scan Next Job
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer: Save & Next Job */}
          {phase !== 'job-done' && savedLines > 0 && (
            <div className="sse-footer">
              <Button
                variant="outlined"
                onClick={handleFinishJob}
                startIcon={<Save size={15} />}
                className="sse-btn-next-job"
              >
                Save &amp; Scan Next Job
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SingleSingleEntry;