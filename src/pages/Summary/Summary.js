import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ArrowLeft, ArrowRight, User, Lock, Layers, Package,
  ScanLine, CheckCircle2, ChevronDown, ChevronUp,
  Hash, Weight, AlertTriangle, XCircle,
} from 'lucide-react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { PROCESS_SUBTYPE_LABELS } from '../../Utils/processLabels';
import { materialTypeLabel } from '../../Utils/materialTypes';
import './Summary.scss';

const PROCESS_LABELS = PROCESS_SUBTYPE_LABELS;

const getMaterialColor = (material) => {
  const m = (material || '').toLowerCase();
  if (m.includes('diamond:s'))    return '#6343f1';
  if (m.includes('colorstone:g')) return '#00897b';
  if (m.includes('diamond'))      return '#e91e63';
  if (m.includes('colorstone'))   return '#9c27b0';
  if (m.includes('finding') || m.includes('misc')) return '#ff9800';
  return 'var(--primary-light)';
};

const getMaterialDesc = (bag) => {
  const findingPart = [bag.findingtypename, bag.findingAccessories].filter(Boolean).join(' · ');
  const specPart    = [bag.shape, bag.quality, bag.color, bag.size].filter(Boolean).join(' · ');
  return [findingPart, specPart].filter(Boolean).join(' · ') || bag.desc || '—';
};

// ─── Single material line row ──────────────────────────────────
const BagEntryRow = ({ bag, idx }) => {
  const color  = getMaterialColor(bag.item || bag.material || '');
  const reqPcs = Number(bag.reqPcs ?? bag.requiredPcs ?? 0);
  const reqWt  = Number(bag.reqWt  ?? bag.requiredWt  ?? 0);
  const pcs    = Number(bag.pcs)   || 0;
  const wt     = Number(bag.wt)    || 0;

  const isEngaged  = pcs > 0 || wt > 0;
  const pcsOk      = reqPcs > 0 ? pcs <= reqPcs : true;
  const wtOk       = reqWt  > 0 ? wt  <= reqWt  : true;
  const bagLabel   = bag.rfbag || bag.bagNo || bag.bagId || null;

  return (
    <div className={`sum-bag-entry ${!isEngaged ? 'sum-bag-entry--not-engaged' : ''}`}>
      {/* Left */}
      <div className="sum-bag-entry__left">
        {/* Engage status dot */}
        <span className={`sum-bag-entry__dot ${isEngaged ? 'sum-bag-entry__dot--ok' : 'sum-bag-entry__dot--no'}`} />

        <div className="sum-bag-entry__info">
          <div className="sum-bag-entry__top-row">
            {bagLabel && <span className="sum-bag-entry__bagno">{bagLabel}</span>}
            {bag.item && (
              <span className="sum-bag-entry__item-type" style={{ color }}>
                {bag.item}
              </span>
            )}
          </div>
          <span className="sum-bag-entry__material">{getMaterialDesc(bag)}</span>
        </div>
      </div>

      {/* Right */}
      {isEngaged ? (
        <div className="sum-bag-entry__right">
          <div className="sum-bag-entry__stat-group sum-bag-entry__stat-group--req">
            <span className="sum-bag-entry__stat-label">Req</span>
            <span className="sum-bag-entry__stat-val">{reqPcs > 0 ? `${reqPcs} pcs` : '—'}</span>
            <span className="sum-bag-entry__stat-val">{reqWt  > 0 ? `${reqWt.toFixed(3)} ctw` : '—'}</span>
          </div>
          <div className="sum-bag-entry__divider" />
          <div className="sum-bag-entry__stat-group sum-bag-entry__stat-group--entered">
            <span className="sum-bag-entry__stat-label sum-bag-entry__stat-label--entered">Entered</span>
            <span className={`sum-bag-entry__stat-val sum-bag-entry__stat-val--entered ${!pcsOk ? 'sum-bag-entry__stat-val--over' : ''}`}>
              {pcs > 0 ? `${pcs} pcs` : '—'}
            </span>
            <span className={`sum-bag-entry__stat-val sum-bag-entry__stat-val--entered ${!wtOk ? 'sum-bag-entry__stat-val--over' : ''}`}>
              {wt > 0 ? `${wt.toFixed(3)} ctw` : '—'}
            </span>
          </div>
        </div>
      ) : (
        <div className="sum-bag-entry__not-engaged-pill">
          <XCircle size={11} />
          Not Engaged
        </div>
      )}
    </div>
  );
};

// ─── Job Card ─────────────────────────────────────────────────
const JobCard = ({ job, entries, index }) => {
  const [open, setOpen] = React.useState(true);

  // Normalize all entries — show ALL of them (engaged + not engaged)
  const allEntries = entries.map((b) => ({
    ...b,
    reqPcs : Number(b.reqPcs  ?? b.requiredPcs ?? 0),
    reqWt  : Number(b.reqWt   ?? b.requiredWt  ?? 0),
    pcs    : Number(b.pcs)    || 0,
    wt     : Number(b.wt)     || 0,
    item   : b.item || b.Item || b.itemName || b.ItemName || '',
  }));

  const engagedEntries    = allEntries.filter((b) => b.pcs > 0 || b.wt > 0);
  const notEngagedEntries = allEntries.filter((b) => b.pcs === 0 && b.wt === 0);

  const jobPcs  = engagedEntries.reduce((s, b) => s + b.pcs, 0);
  const jobWt   = engagedEntries.reduce((s, b) => s + b.wt,  0);
  const reqPcs  = allEntries.reduce((s, b) => s + b.reqPcs, 0);
  const reqWt   = allEntries.reduce((s, b) => s + b.reqWt,  0);

  const totalLines    = allEntries.length;
  const engagedCount  = engagedEntries.length;
  const allEngaged    = totalLines > 0 && engagedCount === totalLines;
  const noneEngaged   = totalLines > 0 && engagedCount === 0;
  const partiallyEng  = !allEngaged && !noneEngaged;

  const cardClass = [
    'sum-job-card',
    open ? 'sum-job-card--open' : '',
    noneEngaged   ? 'sum-job-card--warning'  : '',
    partiallyEng  ? 'sum-job-card--partial'  : '',
  ].filter(Boolean).join(' ');

  const badgeClass = [
    'sum-job-card__badge',
    noneEngaged  ? 'sum-job-card__badge--warning' : '',
    partiallyEng ? 'sum-job-card__badge--partial' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      <div className="sum-job-card__header" onClick={() => setOpen(v => !v)}>
        <div className="sum-job-card__header-left">
          <span className="sum-job-card__index">#{index + 1}</span>
          <div className="sum-job-card__id-block">
            <span className="sum-job-card__id">{job.serialjobno || job.id}</span>
            {job.design && <span className="sum-job-card__meta">{job.design}</span>}
          </div>

          {/* Engaged / partial / not-engaged badge */}
          <span className={badgeClass}>
            {noneEngaged ? (
              <><AlertTriangle size={11} /> Not Engaged</>
            ) : partiallyEng ? (
              <><AlertTriangle size={11} /> {engagedCount}/{totalLines} Engaged</>
            ) : (
              <><CheckCircle2 size={11} /> {engagedCount} Engaged</>
            )}
          </span>
        </div>

        <div className="sum-job-card__header-right">
          {engagedCount > 0 && (
            <div className="sum-job-card__totals">
              <div className="sum-job-card__total-pill">
                <Hash size={11} />
                <span>{jobPcs}<em>pcs</em></span>
              </div>
              <div className="sum-job-card__total-pill sum-job-card__total-pill--wt">
                <Weight size={11} />
                <span>{jobWt.toFixed(3)}<em>ctw</em></span>
              </div>
            </div>
          )}
          <button className="sum-job-card__toggle" tabIndex={-1}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="sum-job-card__body">
          {totalLines === 0 ? (
            <div className="sum-job-card__empty sum-job-card__empty--warning">
              <AlertTriangle size={14} />
              <span>No material lines found for this job.</span>
            </div>
          ) : (
            <>
              {/* Show ALL material rows (engaged first, then not-engaged) */}
              {[...engagedEntries, ...notEngagedEntries].map((bag, idx) => (
                <BagEntryRow key={bag.rfbag || bag.rowKey || idx} bag={bag} idx={idx} />
              ))}

              {/* Footer totals when multiple lines */}
              {allEntries.length > 1 && engagedCount > 0 && (
                <div className="sum-job-card__footer">
                  <span className="sum-job-card__footer-label">Entered Total</span>
                  <div className="sum-job-card__footer-vals">
                    {reqPcs > 0 && (
                      <span className="sum-job-card__footer-req">
                        Req: {reqPcs} pcs · {reqWt.toFixed(3)} ctw
                      </span>
                    )}
                    <span className="sum-job-card__footer-entered">
                      {jobPcs} pcs · {jobWt.toFixed(3)} ctw
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Summary ─────────────────────────────────────────────
const Summary = () => {
  const navigate      = useNavigate();
  const { state, actions } = useEngage();
  const jobverification = sessionStorage.getItem('jobverification');
  useEffect(() => { actions.setStep(jobverification === 'true' ? 4 : 7); }, []); // eslint-disable-line
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Only count truly engaged rows for the top stats
  const allBags = Object.values(state.jobEntries || {})
    .flatMap(job => job.bags || [])
    .map((b) => ({ ...b, pcs: Number(b.pcs) || 0, wt: Number(b.wt) || 0 }))
    .filter((b) => b.pcs > 0 || b.wt > 0);

  const totalJobs = state.scannedJobs?.length || 0;
  const totalPcs  = allBags.reduce((s, b) => s + b.pcs, 0);
  const totalWt   = allBags.reduce((s, b) => s + b.wt,  0);

  const processLabel  = PROCESS_LABELS[state.processSubType] || state.processSubType || '—';
  const materialLabel = state.materialType ? materialTypeLabel(state.materialType) : '—';

  const getJobEntries = (job) => {
    const perJob = state.jobEntries?.[job.id]?.bags;
    if (perJob?.length) return perJob;
    const norm = (s) => String(s ?? '').trim().toUpperCase();
    const bulkBags = state.jobEntries?.['bulk-material']?.bags || [];
    return bulkBags.filter((b) => {
      if (norm(b.serialjobno ?? '') === norm(job.id)) return true;
      return norm(b.rowKey ?? '').startsWith(norm(job.id) + '||');
    });
  };

  // A job is "fully not engaged" only if EVERY entry is 0
  const notEngagedJobs = (state.scannedJobs || []).filter((job) => {
    const entries = getJobEntries(job);
    return !entries.some((b) => (Number(b.pcs) || 0) > 0 || (Number(b.wt) || 0) > 0);
  });

  // Jobs with at least some engagement (partial or full) go LEFT
  const engagedJobs = (state.scannedJobs || []).filter((job) => {
    const entries = getJobEntries(job);
    return entries.some((b) => (Number(b.pcs) || 0) > 0 || (Number(b.wt) || 0) > 0);
  });

  const goToConfirmation = () => navigate('/confirmation');

  const handleSaveContinue = () => {
    if (notEngagedJobs.length > 0) {
      setConfirmOpen(true);
    } else {
      goToConfirmation();
    }
  };

  return (
    <div className="summary page-enter">
      {/* ── Header ── */}
      <div className="summary__header">
        <h1 className="summary__title">Summary</h1>
        <p className="summary__desc">Review all details before final processing</p>
      </div>

      {/* ── Info Strip ── */}
      <div className="summary__info-strip">
        <div className="summary__info-item">
          <div className="summary__info-icon summary__info-icon--blue"><User size={15} /></div>
          <div className="summary__info-text">
            <span>Employee</span>
            <strong>{state.employee?.name || 'N/A'}</strong>
          </div>
        </div>
        <div className="summary__info-sep" />
        <div className="summary__info-item">
          <div className="summary__info-icon summary__info-icon--green"><Lock size={15} /></div>
          <div className="summary__info-text">
            <span>Locker</span>
            <strong>{state.locker?.name || 'N/A'}</strong>
          </div>
        </div>
        <div className="summary__info-sep" />
        <div className="summary__info-item">
          <div className="summary__info-icon summary__info-icon--orange"><Layers size={15} /></div>
          <div className="summary__info-text">
            <span>Process</span>
            <strong>{processLabel}</strong>
          </div>
        </div>
        <div className="summary__info-sep" />
        <div className="summary__info-item">
          <div className="summary__info-icon summary__info-icon--purple"><Package size={15} /></div>
          <div className="summary__info-text">
            <span>Material</span>
            <strong>{materialLabel}</strong>
          </div>
        </div>
        <div className="summary__info-sep summary__info-sep--spacer" />
        <div className="summary__stat-pills">
          <div className="summary__stat-pill">
            <ScanLine size={13} />
            <span>{totalJobs} Job{totalJobs !== 1 ? 's' : ''}</span>
          </div>
          <div className="summary__stat-pill">
            <Hash size={13} />
            <span>{totalPcs} PCS</span>
          </div>
          <div className="summary__stat-pill summary__stat-pill--highlight">
            <Weight size={13} />
            <span>{totalWt.toFixed(3)} ctw</span>
          </div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="summary__body summary__body--split">

        {/* LEFT — all jobs that have at least 1 engaged material */}
        <div className="summary__col summary__col--left">
          <div className="summary__section-header">
            <span className="summary__section-title">Job Entries</span>
            <span className="summary__section-count">{engagedJobs.length}</span>
            {/* warn if any job is partially engaged */}
            {engagedJobs.some((job) => {
              const e = getJobEntries(job);
              const hasAny = e.some((b) => (Number(b.pcs)||0)>0||(Number(b.wt)||0)>0);
              const allEng = e.every((b) => (Number(b.pcs)||0)>0||(Number(b.wt)||0)>0);
              return hasAny && !allEng;
            }) && (
              <span className="summary__section-warning">
                <AlertTriangle size={12} /> Partial entries
              </span>
            )}
          </div>

          {engagedJobs.length === 0 ? (
            <div className="summary__empty">
              <ScanLine size={28} />
              <span>No jobs have been engaged yet.</span>
            </div>
          ) : (
            <div className="summary__jobs-list">
              {(state.scannedJobs || [])
                .filter((job) => engagedJobs.some((ej) => ej.id === job.id))
                .map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    entries={getJobEntries(job)}
                    index={(state.scannedJobs || []).indexOf(job)}
                  />
                ))}
            </div>
          )}
        </div>

        {/* RIGHT — jobs with zero engagement */}
        {notEngagedJobs.length > 0 && (
          <div className="summary__col summary__col--right">
            <div className="summary__section-header">
              <span className="summary__section-title">Not Engaged</span>
              <span className="summary__section-count summary__section-count--warn">
                <AlertTriangle size={11} />
                {notEngagedJobs.length}
              </span>
            </div>

            <div className="summary__not-engaged-info">
              <AlertTriangle size={14} />
              <span>
                {notEngagedJobs.length === 1
                  ? 'This job has no material engaged.'
                  : `These ${notEngagedJobs.length} jobs have no material engaged.`}
              </span>
            </div>

            <div className="summary__jobs-list">
              {(state.scannedJobs || [])
                .filter((job) => notEngagedJobs.some((nj) => nj.id === job.id))
                .map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    entries={getJobEntries(job)}
                    index={(state.scannedJobs || []).indexOf(job)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="summary__actions">
        <Button
          variant="outlined"
          onClick={() =>
            jobverification === 'true'
              ? navigate('/job-verification')
              : navigate('/material-entry')
          }
          startIcon={<ArrowLeft size={18} />}
          className="summary__back-btn"
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleSaveContinue}
          endIcon={<ArrowRight size={20} />}
          className="summary__continue-btn"
        >
          Save &amp; Continue
        </Button>
      </div>

      {/* ── Not-Engaged Confirmation Dialog ── */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{ className: 'summary__confirm-paper' }}
      >
        <DialogTitle className="summary__confirm-title">
          <div className="summary__confirm-title-icon">
            <AlertTriangle size={22} />
          </div>
          <span>Some Material Is Not Engaged</span>
        </DialogTitle>

        <DialogContent>
          <DialogContentText className="summary__confirm-text">
            {notEngagedJobs.length === 1 ? (
              <>
                Job <strong>{notEngagedJobs[0]?.id || notEngagedJobs[0]?.serialjobno}</strong> has
                no material engaged. If you continue, this job will be processed without any
                material entry.
              </>
            ) : (
              <>
                <strong>{notEngagedJobs.length} jobs</strong> have no material engaged. If you
                continue, they will be processed without any material entry.
              </>
            )}
          </DialogContentText>

          <div className="summary__confirm-jobs">
            {notEngagedJobs.map((j) => (
              <div key={j.id} className="summary__confirm-job-chip">
                <AlertTriangle size={11} />
                {j.id || j.serialjobno}
              </div>
            ))}
          </div>

          <DialogContentText className="summary__confirm-question">
            Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>

        <DialogActions className="summary__confirm-actions">
          <Button
            variant="outlined"
            onClick={() => setConfirmOpen(false)}
            className="summary__confirm-no"
          >
            No, Go Back
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => { setConfirmOpen(false); goToConfirmation(); }}
            className="summary__confirm-yes"
          >
            Yes, Continue
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Summary;