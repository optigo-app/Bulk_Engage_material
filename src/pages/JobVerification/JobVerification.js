import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ScanLine, ArrowLeft, ArrowRight, RotateCcw, CheckCircle2,
  AlertCircle, Gem, Palette, Wrench, Stone, Package, AlertTriangle,
} from 'lucide-react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { getMaster, removeMaster } from '../../Utils/masterStore';
import { CallApi } from '../../API/CallApi/CallApi';
import { refreshSessionData } from '../../Utils/refreshSessionData';
import '../MaterialEntry/BulkSingleEntry/Bulksingleentry.scss';
import './JobVerification.scss';
import { FormControlLabel, Switch } from '@mui/material';

const norm = (s) => String(s ?? '').trim().toUpperCase();
const getEngagedMaterial = () => getMaster('allEngagedMaterial', []);
const getJobListData = () => getMaster('allJobListData', []);

// ── Center-stone (Solitaire / Zemstone) detection ──
// IsCenterStone === 1: itemid 3 -> ":S" (Solitaire), itemid 4 -> ":G" (Zemstone)
const isCenterStone = (m) =>
  Number(m?.IsCenterStone ?? m?.iscenterstone ?? m?.is_sol_gem ?? 0) === 1;

const withCenterSuffix = (name, m) => {
  if (!isCenterStone(m)) return name;
  const u = String(name).toUpperCase();
  if (u.endsWith(':S') || u.endsWith(':G')) return name; // already suffixed
  const id = Number(m?.itemid);
  if (id === 3) return `${name}:S`;
  if (id === 4) return `${name}:G`;
  return name;
};

// Base material name for an itemid, with the center-stone suffix applied.
const itemName = (row) => {
  const base = row?.itemid === 3 ? 'DIAMOND'
    : row?.itemid === 4 ? 'COLORSTONE'
      : row?.itemid === 5 ? 'FINDING' : 'MISC';
  return withCenterSuffix(base, row);
};

const matColor = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return '#6343f1';
  if (u.includes('COLORSTONE:G')) return '#00897b';
  if (u.includes('DIAMOND')) return '#e91e63';
  if (u.includes('COLORSTONE')) return '#9c27b0';
  return '#ff9800';
};

const matIcon = (item = '', size = 13) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S') || u.includes('COLORSTONE:G')) return <Stone size={size} />;
  if (u.includes('DIAMOND')) return <Gem size={size} />;
  if (u.includes('COLORSTONE')) return <Palette size={size} />;
  if (u.includes('FINDING')) return <Wrench size={size} />;
  return <Package size={size} />;
};

const matLabel = (item = '') => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return 'Diamond:S';
  if (u.includes('COLORSTONE:G')) return 'Colorstone:G';
  if (u.includes('DIAMOND')) return 'Diamond';
  if (u.includes('COLORSTONE')) return 'Colorstone';
  if (u.includes('FINDING')) return 'Finding';
  if (u.includes('MISC')) return 'Misc';
  return item;
};

const JobVerification = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();

  const [scanValue, setScanValue] = useState('');
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);

  // txnid -> { pcs, cwt } — editable values for unlocked rows
  const [inputs, setInputs] = useState({});
  // Set of txnids currently unlocked (Return button clicked)
  const [returnedTxns, setReturnedTxns] = useState(() => new Set());
  // Set of txnids where "Return All" was clicked (no changes, call returnall API)
  const [returnAllTxns, setReturnAllTxns] = useState(() => new Set());
  // Validation errors per txnid: { [txnid]: { pcs?: string, cwt?: string } }
  const [inputErrors, setInputErrors] = useState({});

  // Confirm Engagement dialog + processing + success states
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Serial job no that was scanned but has no engaged material
  const [noMaterialJob, setNoMaterialJob] = useState('');

  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef(null);

  const allEngaged = useMemo(() => getEngagedMaterial(), []);
  const allJobList = useMemo(() => getJobListData(), []);
  const [jobVerification, setJobVerification] = useState();

  useEffect(() => {
    // This page owns the Job Verification flow, so make sure the sidebar shows
    // the JV step list while we're here (it may have been turned off if the
    // user previously continued into the normal Engage Material flow).
    try { sessionStorage.setItem('jobverification', 'true'); } catch {}
    actions.setStep(3);
    if (!state.locker) navigate('/select-locker');
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global barcode scanner listener
  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        const val = bufferRef.current.trim();
        bufferRef.current = '';
        clearTimeout(bufferTimerRef.current);
        if (val) triggerScan(val);
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => {
          const val = bufferRef.current.trim();
          bufferRef.current = '';
          if (val) triggerScan(val);
        }, 300);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(bufferTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasTxn = (t) => t !== undefined && t !== null && t !== '';

  const triggerScan = (val) => {
    const serial = String(val || '').trim();
    if (!serial) return;
    setError('');

    const rows = allEngaged.filter(
      (e) => e.isengage && norm(e.serialjobno) === norm(serial)
    );

    if (!rows.length) {
      setJob(null);
      setError('');
      setNoMaterialJob(serial);
      setScanValue('');
      return;
    }
    setNoMaterialJob('');

    // Auto-set "Engage Completed?" toggle based on the job's isenage value
    // from the joblist API (allJobListData):
    //   isenage == 2 → ON (engage completed)
    //   isenage == 1 → OFF
    const matchedJobRow = allJobList.find(
      (j) => norm(j.serialjobno) === norm(serial)
    );
    if (matchedJobRow && matchedJobRow.isenage != null) {
      const newVal = Number(matchedJobRow.isenage) === 2;
      setJobVerification(newVal);
    }

    // Seed inputs from original engaged values
    const initInputs = {};
    rows.forEach((r) => {
      if (hasTxn(r.txnid)) {
        initInputs[r.txnid] = {
          pcs: String(r.isspcs ?? ''),
          cwt: Number(r.isswt ?? 0).toFixed(3),
        };
      }
    });

    setJob({ serialjobno: serial, rows });
    setInputs(initInputs);
    setReturnedTxns(new Set());
    setReturnAllTxns(new Set());
    setInputErrors({});
    setScanValue('');
    inputRef.current?.focus();
  };

  const handleScan = () => triggerScan(scanValue);
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleScan(); };

  // Input change with validation — cannot exceed original engaged amount
  const handleInput = (txnid, field, val, origPcs, origWt) => {
    setInputs((prev) => ({ ...prev, [txnid]: { ...prev[txnid], [field]: val } }));

    setInputErrors((prev) => {
      const errs = { ...(prev[txnid] || {}) };
      const num = parseFloat(val) || 0;
      if (field === 'pcs') {
        errs.pcs = num > Number(origPcs) ? `Max ${origPcs}` : '';
      }
      if (field === 'cwt') {
        errs.cwt = num > Number(origWt) ? `Max ${Number(origWt).toFixed(3)}` : '';
      }
      return { ...prev, [txnid]: errs };
    });
  };

  // Return button click — unlock row for editing
  const handleReturnClick = (r) => {
    if (jobVerification) return; // Engage Completed → no returns allowed
    if (!hasTxn(r.txnid)) { setError('No transaction id found.'); return; }
    setError('');
    setReturnedTxns((prev) => {
      const next = new Set(prev);
      next.add(r.txnid);
      return next;
    });
  };

  // Return All button click — mark for returnall API, no input needed
  const handleReturnAll = (r) => {
    if (jobVerification) return; // Engage Completed → no returns allowed
    if (!hasTxn(r.txnid)) return;
    setReturnAllTxns((prev) => {
      const next = new Set(prev);
      next.add(r.txnid);
      return next;
    });
    // Also unlock so UI shows it's processed
    setReturnedTxns((prev) => {
      const next = new Set(prev);
      next.add(r.txnid);
      return next;
    });
    // Reset inputs to original (full return)
    setInputs((prev) => ({
      ...prev,
      [r.txnid]: {
        pcs: String(r.isspcs ?? ''),
        cwt: Number(r.isswt ?? 0).toFixed(3),
      },
    }));
  };

  const hasAnyErrors = Object.values(inputErrors).some(
    (e) => e?.pcs || e?.cwt
  );

  // SAVE button click — show the Confirm Engagement dialog
  const handleSave = () => {
    if (!job) return;
    if (hasAnyErrors) return;
    setSaveError('');
    setShowDialog(true);
  };

  // Confirm Engagement dialog → "Bagging Running" (0) or "Bagging Completed" (1)
  const handleEngage = async (isengagecompleted) => {
    if (!job) return;
    setSaveError('');
    setShowDialog(false);
    setIsProcessing(true);

    const reportData = (() => {
      try { return JSON.parse(sessionStorage.getItem('reportVarible') || '{}'); }
      catch { return {}; }
    })();
    const appuserid = reportData?.LUId || '';
    const clientIP = sessionStorage.getItem('clientIpAddress') || '';

    // 1. Call returnall API for "Return All" rows (no changes)
    const returnAllRows = job.rows.filter(
      (r) => hasTxn(r.txnid) && returnAllTxns.has(r.txnid)
    );
    if (returnAllRows.length > 0) {
      try {
        const returnAllBody = {
          con: JSON.stringify({
            id: '',
            mode: 'returnall',
            appuserid,
            IPAddress: clientIP,
          }),

          p: JSON.stringify({
            txnid: returnAllRows.map((r) => r.txnid).join(','),
          }),

          f: 'DynamicReport ( get sp list )',
        };
        await CallApi(returnAllBody);
      } catch (err) {
        console.error('Return all error:', err);
      }
    }

    // 2. Build engagesave payload for partial-return rows
    //    Partial return: pass (original - entered) as the remaining qty
    const allJobs = getMaster('allJobListData', []);
    const matchedJob = allJobs.find(
      (j) => norm(String(j.SerialJobNo ?? j.serialjobno ?? '')) === norm(job.serialjobno)
    );
    const resolvedJid = String(matchedJob?.JId ?? matchedJob?.jid ?? matchedJob?.Jid ?? '');

    const jobMaterialData = (() => {
      try { return JSON.parse(sessionStorage.getItem('scannedJobMaterialData') || '[]'); }
      catch { return []; }
    })();

    const eid = String(
      state.employee?.id ?? state.employee?.eid ?? state.employee?.empid ?? ''
    );

    // Partial-return rows: send (original - entered) as the remaining engaged qty
    const partialRows = job.rows
      .filter((r) => hasTxn(r.txnid) && returnedTxns.has(r.txnid) && !returnAllTxns.has(r.txnid))
      .map((r) => {
        const inp = inputs[r.txnid] || {
          pcs: String(r.isspcs ?? ''),
          cwt: Number(r.isswt ?? 0).toFixed(3),
        };
        const origPcs = Number(r.isspcs ?? 0);
        const origWt = Number(r.isswt ?? 0);
        const enteredPcs = parseFloat(inp.pcs) || 0;
        const enteredWt = parseFloat(inp.cwt) || 0;
        const remainingPcs = origPcs - enteredPcs;
        const remainingWt = parseFloat((origWt - enteredWt).toFixed(3));

        const matLine = jobMaterialData.find(
          (m) => norm(m.SerialJobNo) === norm(job.serialjobno) &&
            norm(m.shape) === norm(r.shape) &&
            norm(m.Quality) === norm(r.Quality) &&
            norm(m.color) === norm(r.color) &&
            norm(m.Size ?? m.size ?? '') === norm(r.Size)
        );
        const resolvedQid = String(matLine?.qid ?? '');
        return {
          txnid: r.txnid,
          jid: resolvedJid,
          qid: resolvedQid,
          rfbag: r.rfbag || '',
          eid,
          wt: remainingWt,
          pcs: remainingPcs,
          isengagecompleted,
        };
      })
      .filter((r) => r.wt > 0 || r.pcs > 0);

    // 3. Call engagesave API for the partial-return rows
    if (partialRows.length > 0) {
      try {
        const apiBody = {
          con: JSON.stringify({
            id: '',
            mode: 'engagesave',
            appuserid,
            IPAddress: clientIP,
          }),
          p: JSON.stringify({ data: partialRows }),
          f: 'DynamicReport ( get sp list )',
        };
        await CallApi(apiBody);
      } catch (err) {
        console.error('Engage save error:', err);
        setIsProcessing(false);
        setSaveError('Engage save failed. Please try again.');
        return;
      }
    }

    // 4. Cleanup + show the success screen (no navigation)
    sessionStorage.removeItem('scannedBagData');
    sessionStorage.removeItem('scannedJobListData');
    sessionStorage.removeItem('scannedJobMaterialData');
    setIsProcessing(false);
    setIsSuccess(true);
    actions.setComplete(true);
  };

  const handleNewProcess = async () => {
    ['allJobListData', 'allBagListData', 'allEmployeeLockerData', 'allJobMaterialData', 'allEngagedMaterial'].forEach(
      (k) => removeMaster(k),
    );
    sessionStorage.removeItem('scannedBagData');
    sessionStorage.removeItem('scannedJobListData');
    sessionStorage.removeItem('scannedJobMaterialData');
    setIsProcessing(true);
    try {
      await refreshSessionData(setIsProcessing);
    } catch (err) {
      console.error('Session refresh error:', err);
    }
    setIsProcessing(false);
    actions.reset();
    navigate('/');
  };

  const pills = useMemo(() => {
    if (!job) return [];
    const groups = {};
    job.rows.forEach((r) => {
      const item = withCenterSuffix(r.item || itemName(r), r);
      if (!groups[item]) groups[item] = { pcs: 0, wt: 0 };
      groups[item].pcs += Number(r.isspcs || 0);
      groups[item].wt += Number(r.isswt || 0);
    });
    return Object.entries(groups);
  }, [job]);

  const anyAction = returnedTxns.size > 0 || returnAllTxns.size > 0;

  // Build engagesave rows from the current job's engaged material.
  // isengagecompleted: 0 = Bagging Running, 1 = Bagging Completed
  const buildEngageRows = (isengagecompleted) => {
    if (!job) return [];
    const eid = String(
      state.employee?.id ?? state.employee?.eid ?? state.employee?.empid ?? ''
    );

    const allJobs = getMaster('allJobListData', []);
    const matchedJobRow = allJobs.find(
      (j) => norm(String(j.SerialJobNo ?? j.serialjobno ?? '')) === norm(job.serialjobno)
    );
    const resolvedJid = String(matchedJobRow?.JId ?? matchedJobRow?.jid ?? '');

    const jobMaterialData = (() => {
      try { return JSON.parse(sessionStorage.getItem('scannedJobMaterialData') || '[]'); }
      catch { return []; }
    })();

    return job.rows
      .filter((r) => hasTxn(r.txnid))
      .map((r) => {
        const matLine = jobMaterialData.find(
          (m) => norm(m.SerialJobNo) === norm(job.serialjobno) &&
            norm(m.shape) === norm(r.shape) &&
            norm(m.Quality) === norm(r.Quality) &&
            norm(m.color) === norm(r.color) &&
            norm(m.Size ?? m.size ?? '') === norm(r.Size)
        );
        const resolvedQid = String(matLine?.qid ?? '');
        return {
          txnid: r.txnid,
          jid: resolvedJid,
          qid: resolvedQid,
          rfbag: r.rfbag || '',
          eid,
          wt: Number(r.isswt ?? 0),
          pcs: Number(r.isspcs ?? 0),
          isengagecompleted,
        };
      });
  };

  // Call engagesave API in the background (for the toggle change)
  const callEngageSaveInBackground = async (isengagecompleted) => {
    try {
      const rows = buildEngageRows(isengagecompleted);
      if (!rows.length) return;
      const reportData = (() => {
        try { return JSON.parse(sessionStorage.getItem('reportVarible') || '{}'); }
        catch { return {}; }
      })();
      const appuserid = reportData?.LUId || '';
      const clientIP = sessionStorage.getItem('clientIpAddress') || '';
      const apiBody = {
        con: JSON.stringify({
          id: '',
          mode: 'engagesave',
          appuserid,
          IPAddress: clientIP,
        }),
        p: JSON.stringify({ data: rows }),
        f: 'DynamicReport ( get sp list )',
      };
      await CallApi(apiBody);
    } catch (err) {
      console.error('Background engage save error:', err);
    }
  };

  // "Engage Completed?" is per-job engage state — it does NOT control the
  // sidebar flow flag, so it must not touch sessionStorage('jobverification').
  const handleJobVerificationChange = (e) => {
    const val = e.target.checked;
    setJobVerification(val);
    // Call engagesave API in the background: ON → isengagecompleted=1, OFF → isengagecompleted=0
    callEngageSaveInBackground(val ? 1 : 0);
  };

  // No engaged material → user continues into the normal Engage Material flow.
  // Switch the sidebar off the Job Verification step list and reset progress
  // to "Select Process" so the sidebar reflects where the user actually is.
  const handleGoToEngageMaterial = () => {
    try { sessionStorage.setItem('jobverification', 'false'); } catch {}
    setNoMaterialJob('');
    actions.setStep(3);
    navigate('/select-process');
  };

  // ══ Success screen (after SAVE) ══
  if (isSuccess) {
    return (
      <div className="job-verify page-enter">
        <div className="job-verify__result">
          <div className="job-verify__result-card job-verify__result-card--success">
            <div className="job-verify__result-icon job-verify__result-icon--success">
              <CheckCircle2 size={56} />
            </div>
            <h1>Return Saved Successfully!</h1>
            <p>The engaged material for this job has been updated.</p>
            <div className="job-verify__result-details">
              <div className="job-verify__result-detail">
                <span>Job</span>
                <strong>{job?.serialjobno || '—'}</strong>
              </div>
              <div className="job-verify__result-detail">
                <span>Return All</span>
                <strong>{returnAllTxns.size}</strong>
              </div>
              <div className="job-verify__result-detail">
                <span>Partial Return</span>
                <strong>{Math.max(0, returnedTxns.size - returnAllTxns.size)}</strong>
              </div>
            </div>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleNewProcess}
              startIcon={<RotateCcw size={18} />}
              className="job-verify__result-btn"
            >
              Start New Process
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ══ Processing screen ══
  if (isProcessing) {
    return (
      <div className="job-verify page-enter">
        <div className="job-verify__result">
          <div className="job-verify__result-card">
            <div className="job-verify__result-spinner" />
            <h2>Processing Return...</h2>
            <p>Saving the engaged material. Please wait.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="job-verify page-enter">
      {/* Top bar */}
      <div className="job-verify__topbar">
        <div className="job-verify__scanbox">
          <div className="job-verify__scanbox-icon"><ScanLine size={22} /></div>
          <div className="job-verify__scanbox-input">
            <input
              ref={inputRef}
              type="text"
              className="job-verify__input"
              placeholder="Scan job barcode / serial job no..."
              value={scanValue}
              onChange={(e) => { setScanValue(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleScan}
              disabled={!scanValue.trim()}
              className="job-verify__scan-btn"
            >
              Submit
            </Button>
          </div>
        </div>



        <div className="job-verify__topbar-right">

          <div className={`job-verify__job-verifynew ${!job ? 'job-verify__job-verifynew--disabled' : ''}`}>
            <FormControlLabel
              className="job-verify__job-verify-toggle"
              control={
                <Switch
                  checked={jobVerification}
                  onChange={handleJobVerificationChange}
                  size="small"
                  color="primary"
                  disabled={!job}
                />
              }
              label="Engage Completed ?"
              labelPlacement="start"
            />
            <span className={`job-verify__job-verify-state ${jobVerification ? 'job-verify__job-verify-state--on' : ''}`}>
              {jobVerification ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* <div className="job-verify__title-block">
            <span className="job-verify__title">Job Verification — Return Material</span>
            <span className="job-verify__sub">Scan a job to view and return its engaged material.</span>
          </div>
          {returnedTxns.size > 0 && (
            <span className="job-verify__returned-note">
              <CheckCircle2 size={13} />
              {returnedTxns.size} entr{returnedTxns.size === 1 ? 'y' : 'ies'} unlocked
            </span>
          )} */}
        </div>
      </div>

      {error && (
        <div className="job-verify__error"><AlertCircle size={13} /> {error}</div>
      )}

      {saveError && (
        <div className="job-verify__error"><AlertTriangle size={13} /> {saveError}</div>
      )}

      <div className="job-verify__body">
        {noMaterialJob ? (
          /* ── No engaged material found for the scanned job ── */
          <div className="job-verify__nomat">
            <div className="job-verify__nomat-icon"><AlertTriangle size={44} /></div>
            <h2>No Engage Material Found</h2>
            <p>
              Job <strong>{noMaterialJob}</strong> has no engaged material to return.
            </p>
            <p className="job-verify__nomat-hint">
              Continue to the Engage Material process to engage material for this job.
            </p>
            <div className="job-verify__nomat-actions">
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleGoToEngageMaterial}
                endIcon={<ArrowRight size={18} />}
                className="job-verify__nomat-btn"
              >
                Engage Material
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setNoMaterialJob(''); setTimeout(() => inputRef.current?.focus(), 80); }}
                startIcon={<ScanLine size={16} />}
                className="job-verify__nomat-rescan"
              >
                Scan Another Job
              </Button>
            </div>
          </div>
        ) : !job ? (
          <div className="job-verify__empty">
            <div className="job-verify__empty-icon"><ScanLine size={38} /></div>
            <span>Scan a job to load its engaged material.</span>
          </div>
        ) : (
          <div className="bse-job">
            {/* Job header */}
            <div className="bse-job-hdr" style={{ cursor: 'default' }}>
              <span className="bse-job-id">{job.serialjobno}</span>
              <div className="bse-pills">
                {pills.map(([item, v]) => (
                  <span key={item} className="bse-pill" style={{ '--pc': matColor(item) }}>
                    <b>{matLabel(item)}</b>{v.wt.toFixed(3)} ctw · {v.pcs} pcs
                  </span>
                ))}
              </div>
              <div className="bse-job-hdr__right">
                <span className="bse-badge">{job.rows.length} lines</span>
              </div>
            </div>

            {/* Table */}
            <div className="bse-table-wrap" style={{ height: '70vh' }}>
              <table className="bse-table">
                <thead>
                  <tr className="bse-thead-main">
                    <th className="bse-th bse-th--sr">Sr</th>
                    <th className="bse-th bse-th--mat">Material</th>
                    <th className="bse-th bse-th--desc">Spec</th>
                    <th className="bse-th bse-th--bag">Bag No</th>
                    <th className="bse-th bse-th--sub">Orig PCS</th>
                    <th className="bse-th bse-th--sub">Orig CT/Gms</th>
                    <th className="bse-th bse-th--sub">Return PCS</th>
                    <th className="bse-th bse-th--sub">Return CT/Gms</th>
                    <th className="bse-th bse-th--sub" style={{ width: '220px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {job.rows.map((r, idx) => {
                    const item = withCenterSuffix(r.item || itemName(r), r);
                    const spec =
                      [r.shape, r.Quality, r.color, r.Size].filter(Boolean).join(' · ') ||
                      [r.findingtypename, r.findingAccessories].filter(Boolean).join(' · ');
                    const isUnlocked = returnedTxns.has(r.txnid);
                    const isReturnAll = returnAllTxns.has(r.txnid);
                    const inp = inputs[r.txnid] || { pcs: '', cwt: '' };
                    const errs = inputErrors[r.txnid] || {};
                    const origPcs = Number(r.isspcs ?? 0);
                    const origWt = Number(r.isswt ?? 0);

                    return (
                      <tr
                        key={`${r.txnid}-${idx}`}
                        className={`bse-tr bse-tr--bag ${isUnlocked ? 'bse-tr--returned' : ''} ${isReturnAll ? 'bse-tr--returnall' : ''}`}
                      >
                        <td className="bse-td bse-td--sr">{idx + 1}</td>
                        <td className="bse-td bse-td--mat">
                          <span className="bse-mat" style={{ color: matColor(item) }}>
                            {matIcon(item)}{r.MaterialTypeName || matLabel(item)}
                          </span>
                        </td>
                        <td className="bse-td bse-td--desc">{spec || '—'}</td>
                        <td className="bse-td bse-td--bag">
                          {r.rfbag ? (
                            <span className="bse-chip bse-chip--auto" style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{r.rfbag}</span>
                              <span className={`bse-owner-badge ${r.iscompany == 1 ? 'bse-owner-badge--company' : 'bse-owner-badge--customer'}`}>
                                {r.iscompany == 1 ? 'Company' : 'Customer'}
                              </span>
                            </span>
                          ) : (
                            <span className="bse-chip bse-chip--none">No Engage</span>
                          )}
                        </td>

                        {/* Original PCS */}
                        <td className="bse-td bse-td--num">{origPcs}</td>

                        {/* Original CT/Gms */}
                        <td className="bse-td bse-td--num">{origWt.toFixed(3)}</td>

                        {/* Return PCS input */}
                        <td className="bse-td bse-td--num">
                          {isReturnAll ? (
                            <span className="job-verify__returnall-tag">All</span>
                          ) : isUnlocked ? (
                            <div className="bmw__entry-cell">
                              <input
                                type="number"
                                className={`bmw__inp ${errs.pcs ? 'bmw__inp--error' : ''}`}
                                value={inp.pcs}
                                min={0}
                                max={origPcs}
                                placeholder={String(origPcs)}
                                onChange={(e) => handleInput(r.txnid, 'pcs', e.target.value, origPcs, origWt)}
                              />
                              {errs.pcs
                                ? <span className="bmw__avl-hint bmw__avl-hint--error">{errs.pcs}</span>
                                : <span className="bmw__avl-hint">Max: {origPcs}</span>
                              }
                            </div>
                          ) : (
                            <span className="bse-muted">—</span>
                          )}
                        </td>

                        {/* Return CT/Gms input */}
                        <td className="bse-td bse-td--num">
                          {isReturnAll ? (
                            <span className="job-verify__returnall-tag">All</span>
                          ) : isUnlocked ? (
                            <div className="bmw__entry-cell">
                              <input
                                type="number"
                                step="0.001"
                                className={`bmw__inp ${errs.cwt ? 'bmw__inp--error' : ''}`}
                                value={inp.cwt}
                                min={0}
                                max={origWt}
                                placeholder={origWt.toFixed(3)}
                                onChange={(e) => handleInput(r.txnid, 'cwt', e.target.value, origPcs, origWt)}
                              />
                              {errs.cwt
                                ? <span className="bmw__avl-hint bmw__avl-hint--error">{errs.cwt}</span>
                                : <span className="bmw__avl-hint">Max: {origWt.toFixed(3)}</span>
                              }
                            </div>
                          ) : (
                            <span className="bse-muted">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="bse-td bse-td--entry" style={{ textAlign: 'center' }}>
                          {!hasTxn(r.txnid) ? (
                            <span className="bse-muted">—</span>
                          ) : isReturnAll ? (
                            <span className="job-verify__returned-tag">
                              <CheckCircle2 size={11} /> Return All
                            </span>
                          ) : isUnlocked ? (
                            <span className="job-verify__returned-tag">
                              <CheckCircle2 size={11} /> Editing
                            </span>
                          ) : jobVerification ? (
                            <span className="bse-muted">—</span>
                          ) : (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                className="job-verify__row-return-btn"
                                onClick={() => handleReturnClick(r)}
                              >
                                <RotateCcw size={11} /> Partial Return
                              </button>
                              <button
                                className="job-verify__row-returnall-btn"
                                onClick={() => handleReturnAll(r)}
                              >
                                <RotateCcw size={11} /> Return All
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="job-verify__actions">
        <Button
          variant="outlined"
          onClick={() => navigate('/select-locker')}
          startIcon={<ArrowLeft size={18} />}
          className="job-verify__back-btn"
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleSave}
          disabled={jobVerification || !anyAction || hasAnyErrors}
          startIcon={<CheckCircle2 size={20} />}
          className="job-verify__continue-btn"
        >
          SAVE
        </Button>
      </div>

      {/* ══ Confirm Engagement dialog (shown inline, no navigation) ══ */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: '#1a2744',
            border: '1px solid #2a3f5f',
            borderRadius: '16px',
            color: '#fff',
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 4, fontWeight: 700, fontSize: 20 }}>
          Confirm Engagement
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <div className="job-verify__dialog-icon">
            <AlertTriangle size={48} />
          </div>
          <p style={{ color: '#94a3b8', marginTop: 16 }}>
            Are you sure you want to save the return for job{' '}
            <strong style={{ color: '#fff' }}>{job?.serialjobno}</strong>? This action will finalize
            the process.
          </p>
          <p style={{ color: '#64748b', marginTop: 8, fontSize: 13 }}>
            Choose <strong style={{ color: '#f59e0b' }}>Bagging Running</strong> if bagging is still
            in progress, or <strong style={{ color: '#4caf50' }}>Bagging Completed</strong> once it is done.
          </p>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 4, gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={() => setShowDialog(false)}
            sx={{
              color: '#94a3b8',
              borderColor: '#2a3f5f',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              height: 44,
              '&:hover': { borderColor: '#94a3b8' }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleEngage(0)}
            sx={{
              background: 'linear-gradient(135deg, #b45309, #f59e0b)',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              height: 44,
              fontSize: 15,
              '&:hover': { background: 'linear-gradient(135deg, #d97706, #fbbf24)' }
            }}
          >
            Bagging Running
          </Button>
          <Button
            variant="contained"
            onClick={() => handleEngage(1)}
            sx={{
              background: 'linear-gradient(135deg, #2e7d32, #4caf50)',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              height: 44,
              fontSize: 15,
              '&:hover': { background: 'linear-gradient(135deg, #388e3c, #66bb6a)' }
            }}
          >
            Bagging Completed
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default JobVerification;