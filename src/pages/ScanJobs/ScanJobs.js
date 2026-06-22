import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { ScanLine, X, ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertTriangle, XCircle, PlusCircle } from 'lucide-react';
import Button from '@mui/material/Button';
import './ScanJobs.scss';

let jobCounter = 1;

const getJobList = () => {
  try {
    const raw = sessionStorage.getItem('allJobListData');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// ── NEW: read allJobMaterialData from sessionStorage ──
const getJobMaterialData = () => {
  try {
    const raw = sessionStorage.getItem('allJobMaterialData');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const ScanJobs = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [scanValue, setScanValue] = useState('');
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [phase, setPhase] = useState(null);
  const [verificationResult, setVerificationResult] = useState({
    validJobs: [],
    invalidJobs: [],
  });

  const allJobDataRef = useRef([]);
  const validSerialNosRef = useRef(new Set());

  useEffect(() => {
    actions.setStep(4);
    if (!state.processSubType) navigate('/select-process');

    const data = getJobList();
    allJobDataRef.current = data;
    validSerialNosRef.current = new Set(data.map((d) => d.serialjobno));

    inputRef.current?.focus();
  }, []);

  const inputRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = gridRef.current.scrollHeight;
    }
  }, [state.scannedJobs.length]);

  const handleScan = () => {
    const val = scanValue.trim();
    if (!val) return;

    if (state.scannedJobs.find((j) => j.serialjobno === val)) {
      setScanValue('');
      inputRef.current?.focus();
      return;
    }

    const matchedJob = allJobDataRef.current.find(
      (d) => d.serialjobno?.toLowerCase() === val.toLowerCase()
    );

    const newJob = {
      id: val,
      number: `J/${String(jobCounter).padStart(1, '0')}`,
      scannedAt: new Date().toLocaleTimeString(),
      isValid: !!matchedJob,
      serialjobno: matchedJob?.serialjobno ?? val,
      design:      matchedJob?.design      ?? null,
      category:    matchedJob?.category    ?? null,
      ccode:       matchedJob?.ccode       ?? null,
      cname:       matchedJob?.cname       ?? null,
      color:       matchedJob?.color       ?? null,
      metal:       matchedJob?.metal       ?? null,
      status:      matchedJob?.status      ?? null,
      location:    matchedJob?.location    ?? null,
    };

    jobCounter++;
    actions.addScannedJob(newJob);
    setScanValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  const handleRemoveJob = (id) => {
    actions.removeScannedJob(id);
  };

  const handleContinue = () => {
    if (state.scannedJobs.length === 0) return;
    setPhase('verifying');
    setLoaderProgress(0);
    const interval = setInterval(() => {
      setLoaderProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => runValidation(), 400);
          return 100;
        }
        return prev + 2;
      });
    }, 40);
  };

  const runValidation = () => {
    const validJobs   = state.scannedJobs.filter((j) => validSerialNosRef.current.has(j.serialjobno));
    const invalidJobs = state.scannedJobs.filter((j) => !validSerialNosRef.current.has(j.serialjobno));
    setVerificationResult({ validJobs, invalidJobs });
    setPhase('result');
  };

  // ── UPDATED: save to sessionStorage then navigate ──
  const handleGoToNext = () => {
    // 1. Save scanned jobs list
    sessionStorage.setItem('scannedJobListData', JSON.stringify(state.scannedJobs));

    // 2. Match scanned serial job nos against allJobMaterialData.SerialJobNo
    const allMaterialData = getJobMaterialData();
    const scannedSerialNos = new Set(
      state.scannedJobs.map((j) => j.serialjobno?.toLowerCase())
    );
    const matchedMaterials = allMaterialData.filter((m) =>
      scannedSerialNos.has(m.SerialJobNo?.toLowerCase())
    );
    sessionStorage.setItem('scannedJobMaterialData', JSON.stringify(matchedMaterials));

    navigate('/bag-scanning');
  };

  // ── NEW: "Add More Jobs" — go back to scanning mode from all-valid overlay ──
  const handleAddMoreJobs = () => {
    setPhase(null);
    setVerificationResult({ validJobs: [], invalidJobs: [] });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleProceedAnyway  = () => navigate('/bag-scanning');
  const handleGoBackAndFix   = () => {
    setPhase('fixing');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const remainingInvalidCount =
    phase === 'fixing'
      ? state.scannedJobs.filter((j) => !validSerialNosRef.current.has(j.serialjobno)).length
      : 0;

  const allValid   = phase === 'result' && verificationResult.invalidJobs.length === 0;
  const hasInvalid = phase === 'result' && verificationResult.invalidJobs.length > 0;

  const getCardClass = (job) => {
    let cls = 'scan-jobs__job-card';
    if (phase === 'result' || phase === 'fixing') {
      cls += validSerialNosRef.current.has(job.serialjobno)
        ? ' scan-jobs__job-card--valid'
        : ' scan-jobs__job-card--invalid';
    }
    return cls;
  };

  return (
    <div className="scan-jobs page-enter">

      {/* ─── Header ─── */}
      <div className="scan-jobs__header">
        <div className="scan-jobs__step-badge">Step 4</div>
        <h1 className="scan-jobs__title">Scan Jobs</h1>
        <p className="scan-jobs__desc">Scan all job barcodes for this engage process</p>
      </div>

      {/* ─── Scanner Input ─── */}
      <div className="scan-jobs__scanner">
        <div className="scan-jobs__scanner-visual">
          <div className="scan-jobs__scanner-frame">
            <div className="scan-jobs__barcode-lines">
              <span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span>
            </div>
            <div className="scan-jobs__scan-laser"></div>
          </div>
        </div>
        <div className="scan-jobs__scanner-input">
          <div className="scan-jobs__input-wrapper">
            <ScanLine size={18} className="scan-jobs__input-icon" />
            <input
              ref={inputRef}
              type="text"
              className="scan-jobs__input"
              placeholder="Scan job barcode or enter serial job no..."
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={phase === 'verifying' || phase === 'result'}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleScan}
              disabled={phase === 'verifying' || phase === 'result' || !scanValue.trim()}
              className="scan-jobs__add-btn"
            >
              Add
            </Button>
          </div>
          <div className="scan-jobs__counter">
            Total Scanned Jobs: <strong>{state.scannedJobs.length}</strong>
          </div>
        </div>
      </div>

      {/* ─── Fix Mode Banner ─── */}
      {phase === 'fixing' && (
        <div className="scan-jobs__fix-banner">
          <div className="scan-jobs__fix-banner-left">
            <AlertTriangle size={16} />
            <span>
              <strong>{remainingInvalidCount} invalid</strong> job
              {remainingInvalidCount !== 1 ? 's' : ''} found.
              Click the <X size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> on each red card to remove it.
            </span>
          </div>
          <div className="scan-jobs__fix-banner-legend">
            <span className="scan-jobs__legend-item">
              <span className="scan-jobs__legend-dot scan-jobs__legend-dot--valid" /> Valid
            </span>
            <span className="scan-jobs__legend-item">
              <span className="scan-jobs__legend-dot scan-jobs__legend-dot--invalid" /> Invalid — remove
            </span>
          </div>
        </div>
      )}

      {/* ─── Section Title ─── */}
      <div className="scan-jobs__section-title">
        All Jobs
        {phase === 'fixing' && (
          <span className="scan-jobs__section-counts">
            <span className="scan-jobs__section-count scan-jobs__section-count--valid">
              <CheckCircle2 size={11} />
              {state.scannedJobs.filter((j) => validSerialNosRef.current.has(j.serialjobno)).length} valid
            </span>
            <span className="scan-jobs__section-count scan-jobs__section-count--invalid">
              <XCircle size={11} />
              {remainingInvalidCount} invalid
            </span>
          </span>
        )}
      </div>

      {/* ─── Job Grid ─── */}
      <div className="scan-jobs__grid-wrapper" ref={gridRef}>
        <div className="scan-jobs__grid">
          {state.scannedJobs.length === 0 ? (
            <div className="scan-jobs__empty">
              <div className="scan-jobs__empty-icon"><ScanLine size={40} /></div>
              <span>No jobs scanned yet. Start scanning above.</span>
            </div>
          ) : (
            state.scannedJobs.map((job, idx) => {
              const isJobInvalid = !validSerialNosRef.current.has(job.serialjobno);
              return (
                <div
                  key={job.id}
                  className={getCardClass(job)}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  {(phase === 'result' || phase === 'fixing') && (
                    <span className="scan-jobs__job-status-dot">
                      {isJobInvalid ? '✗' : '✓'}
                    </span>
                  )}
                  <div className="scan-jobs__job-info">
                    <span className="scan-jobs__job-number">{job.serialjobno}</span>
                  </div>
                  {phase === null && (
                    <button className="scan-jobs__job-remove" onClick={() => handleRemoveJob(job.id)}>
                      <X size={14} />
                    </button>
                  )}
                  {phase === 'fixing' && isJobInvalid && (
                    <button
                      className="scan-jobs__job-remove scan-jobs__job-remove--always-visible"
                      onClick={() => handleRemoveJob(job.id)}
                      title="Remove invalid job"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Bottom Actions: scanning (null) ─── */}
      {phase === null && (
        <div className="scan-jobs__actions">
          <Button
            variant="outlined"
            onClick={() => navigate('/select-process')}
            startIcon={<ArrowLeft size={18} />}
            className="scan-jobs__back-btn"
          >
            Back
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleContinue}
            disabled={state.scannedJobs.length === 0}
            endIcon={<ArrowRight size={20} />}
            className="scan-jobs__continue-btn"
          >
            Continue
          </Button>
        </div>
      )}

      {/* ─── Bottom Actions: fixing ─── */}
      {phase === 'fixing' && (
        <div className="scan-jobs__actions">
          <Button
            variant="outlined"
            onClick={() => {
              setPhase(null);
              setVerificationResult({ validJobs: [], invalidJobs: [] });
            }}
            startIcon={<ArrowLeft size={18} />}
            className="scan-jobs__back-btn"
          >
            Back
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleContinue}
            disabled={state.scannedJobs.length === 0 || remainingInvalidCount > 0}
            endIcon={<ArrowRight size={20} />}
            className="scan-jobs__continue-btn"
          >
            {remainingInvalidCount > 0
              ? `Remove ${remainingInvalidCount} invalid job${remainingInvalidCount !== 1 ? 's' : ''} first`
              : 'Continue'}
          </Button>
        </div>
      )}

      {/* ══ OVERLAY: Verifying ══ */}
      {phase === 'verifying' && (
        <div className="scan-jobs__overlay">
          <div className="scan-jobs__loader-card">
            <div className="scan-jobs__loader-circle">
              <svg viewBox="0 0 100 100">
                <circle className="scan-jobs__loader-bg" cx="50" cy="50" r="45" />
                <circle
                  className="scan-jobs__loader-progress"
                  cx="50" cy="50" r="45"
                  style={{ strokeDashoffset: 283 - (283 * loaderProgress) / 100 }}
                />
              </svg>
              <div className="scan-jobs__loader-text">
                {loaderProgress < 100 ? (
                  <>
                    <Loader2 size={20} className="scan-jobs__spinner" />
                    <span>{loaderProgress}%</span>
                  </>
                ) : (
                  <CheckCircle2 size={28} className="scan-jobs__check" />
                )}
              </div>
            </div>
            <p className="scan-jobs__loader-label">
              {loaderProgress < 100 ? 'Verifying scanned jobs… Please wait' : 'Verification complete!'}
            </p>
          </div>
        </div>
      )}

      {/* ══ OVERLAY: All Valid ✓  ── UPDATED with 2 buttons ══ */}
      {phase === 'result' && allValid && (
        <div className="scan-jobs__overlay scan-jobs__overlay--result">
          <div className="scan-jobs__result-card scan-jobs__result-card--success">
            <div className="scan-jobs__result-icon scan-jobs__result-icon--success">
              <CheckCircle2 size={40} />
            </div>
            <div className="scan-jobs__result-content">
              <h2 className="scan-jobs__result-title">All Jobs Verified!</h2>
              <p className="scan-jobs__result-sub">
                {verificationResult.validJobs.length} job
                {verificationResult.validJobs.length !== 1 ? 's' : ''} are ready for bag scanning.
              </p>
              <div className="scan-jobs__result-list">
                {verificationResult.validJobs.map((j) => (
                  <div key={j.id} className="scan-jobs__result-row scan-jobs__result-row--valid">
                    <CheckCircle2 size={14} />
                    <span className="scan-jobs__result-row-id">{j.serialjobno}</span>
                    {j.category && <span className="scan-jobs__result-row-meta">{j.category}</span>}
                    {j.metal    && <span className="scan-jobs__result-row-meta">{j.metal}</span>}
                    <span className="scan-jobs__result-row-badge scan-jobs__result-row-badge--valid">Valid</span>
                  </div>
                ))}
              </div>

              {/* ── 2 buttons: Add More Jobs  |  Continue to Bag Scanning ── */}
              <div className="scan-jobs__result-actions scan-jobs__result-actions--split">
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  onClick={handleAddMoreJobs}
                  startIcon={<PlusCircle size={18} />}
                  className="scan-jobs__result-btn--outline"
                >
                  Add More Jobs
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={handleGoToNext}
                  endIcon={<ArrowRight size={18} />}
                  className="scan-jobs__result-btn"
                >
                  Continue to Bag Scanning
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ OVERLAY: Some Invalid ✗ ══ */}
      {phase === 'result' && hasInvalid && (
        <div className="scan-jobs__overlay scan-jobs__overlay--result">
          <div className="scan-jobs__result-card scan-jobs__result-card--warning">
            <div className="scan-jobs__result-icon scan-jobs__result-icon--warning">
              <AlertTriangle size={40} />
            </div>
            <div className="scan-jobs__result-content">
              <h2 className="scan-jobs__result-title">Some Jobs Are Invalid</h2>
              <p className="scan-jobs__result-sub">
                <strong>{verificationResult.invalidJobs.length}</strong> job
                {verificationResult.invalidJobs.length !== 1 ? 's' : ''} were not found in the system.
              </p>
              <div className="scan-jobs__result-list">
                {verificationResult.validJobs.map((j) => (
                  <div key={j.id} className="scan-jobs__result-row scan-jobs__result-row--valid">
                    <CheckCircle2 size={14} />
                    <span className="scan-jobs__result-row-id">{j.serialjobno}</span>
                    {j.category && <span className="scan-jobs__result-row-meta">{j.category}</span>}
                    <span className="scan-jobs__result-row-badge scan-jobs__result-row-badge--valid">Valid</span>
                  </div>
                ))}
                {verificationResult.invalidJobs.map((j) => (
                  <div key={j.id} className="scan-jobs__result-row scan-jobs__result-row--invalid">
                    <XCircle size={14} />
                    <span className="scan-jobs__result-row-id">{j.serialjobno}</span>
                    <span className="scan-jobs__result-row-badge scan-jobs__result-row-badge--invalid">Not found</span>
                  </div>
                ))}
              </div>
              <div className="scan-jobs__result-actions scan-jobs__result-actions--split">
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  onClick={handleGoBackAndFix}
                  startIcon={<ArrowLeft size={18} />}
                  className="scan-jobs__result-btn--outline"
                >
                  Go Back &amp; Fix
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  size="large"
                  onClick={handleProceedAnyway}
                  endIcon={<ArrowRight size={18} />}
                  className="scan-jobs__result-btn"
                >
                  Yes, Continue Anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanJobs;