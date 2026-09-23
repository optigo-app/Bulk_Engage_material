import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ArrowLeft, ArrowRight, User, Lock, Layers, Package,
  ScanLine, CheckCircle2, Gem, Palette, Wrench,
  ChevronDown, ChevronUp, Hash, Weight,
} from 'lucide-react';
import Button from '@mui/material/Button';
import { PROCESS_SUBTYPE_LABELS } from '../../Utils/processLabels';
import { materialTypeLabel } from '../../Utils/materialTypes';
import './Summary.scss';

const PROCESS_LABELS = PROCESS_SUBTYPE_LABELS;

const getMaterialColor = (material) => {
  const m = (material || '').toLowerCase();
  if (m.includes('diamond:s')) return '#6343f1';
  if (m.includes('colorstone:G')) return '#00897b';
  if (m.includes('diamond')) return '#e91e63';
  if (m.includes('colorstone')) return '#9c27b0';
  if (m.includes('finding') || m.includes('misc')) return '#ff9800';
  return 'var(--primary-light)';
};

const getMaterialDesc = (bag) => {
  const findingPart = [bag.findingtypename, bag.findingAccessories].filter(Boolean).join(' · ');
  const specPart = [bag.shape, bag.quality, bag.color, bag.size].filter(Boolean).join(' · ');
  return [findingPart, specPart].filter(Boolean).join(' · ') || bag.desc || '—';
};

// ─── Bag Entry Row ────────────────────────────────────────────
const BagEntryRow = ({ bag, idx }) => {
  const color = getMaterialColor(bag.material);
  // Entry modes use different field names: reqPcs/reqWt (SingleSingle) vs requiredPcs/requiredWt (others)
  const reqPcs = Number(bag.reqPcs ?? bag.requiredPcs ?? 0);
  const reqWt = Number(bag.reqWt ?? bag.requiredWt ?? 0);
  const pcs = Number(bag.pcs) || 0;
  const wt = Number(bag.wt) || 0;

  // Hide rows where nothing was entered (0 pcs AND 0 wt)
  if (pcs === 0 && wt === 0) return null;

  const pcsOk = reqPcs > 0 ? pcs <= reqPcs : true;
  const wtOk = reqWt > 0 ? wt <= reqWt : true;
  const bagLabel = bag.rfbag || bag.bagNo || bag.bagId || `Bag ${idx + 1}`;

  return (
    <div className="sum-bag-entry">
      {/* Left: bag id + material */}
      <div className="sum-bag-entry__left">
        <span className="sum-bag-entry__bagno">{bagLabel}</span>
        <span className="sum-bag-entry__bagno">{bag.item}</span>
        <span className="sum-bag-entry__material" style={{ color }}>
          {getMaterialDesc(bag)}
        </span>
      </div>

      {/* Right: req vs entered */}
      <div className="sum-bag-entry__right">
        {/* Required */}
        <div className="sum-bag-entry__stat-group sum-bag-entry__stat-group--req">
          <span className="sum-bag-entry__stat-label">Req</span>
          <span className="sum-bag-entry__stat-val">
            {reqPcs} pcs
          </span>
          <span className="sum-bag-entry__stat-val">
            {reqWt.toFixed(3)} ctw
          </span>
        </div>

        {/* Divider */}
        <div className="sum-bag-entry__divider" />

        {/* Entered */}
        <div className="sum-bag-entry__stat-group sum-bag-entry__stat-group--entered">
          <span className="sum-bag-entry__stat-label sum-bag-entry__stat-label--entered">Entered</span>
          <span className={`sum-bag-entry__stat-val sum-bag-entry__stat-val--entered ${!pcsOk ? 'sum-bag-entry__stat-val--over' : ''}`}>
            {pcs} pcs
          </span>
          <span className={`sum-bag-entry__stat-val sum-bag-entry__stat-val--entered ${!wtOk ? 'sum-bag-entry__stat-val--over' : ''}`}>
            {wt.toFixed(3)} ctw
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Job Card (collapsible) ───────────────────────────────────
const JobCard = ({ job, entries, index }) => {
  const [open, setOpen] = React.useState(true);
  // Normalize req fields and filter out zero-entered rows
  const visibleEntries = entries
    .map((b) => ({
      ...b,
      reqPcs: Number(b.reqPcs ?? b.requiredPcs ?? 0),
      reqWt: Number(b.reqWt ?? b.requiredWt ?? 0),
      pcs: Number(b.pcs) || 0,
      wt: Number(b.wt) || 0,
      item: b.item || b.Item || b.itemName || b.ItemName || '',
    }))
    .filter((b) => !(b.pcs === 0 && b.wt === 0));

  const jobPcs = visibleEntries.reduce((s, b) => s + b.pcs, 0);
  const jobWt = visibleEntries.reduce((s, b) => s + b.wt, 0);
  const reqPcs = visibleEntries.reduce((s, b) => s + b.reqPcs, 0);
  const reqWt = visibleEntries.reduce((s, b) => s + b.reqWt, 0);
  const hasEntries = visibleEntries.length > 0;

  return (
    <div className={`sum-job-card ${open ? 'sum-job-card--open' : ''}`}>
      {/* Header */}
      <div className="sum-job-card__header" onClick={() => setOpen(v => !v)}>
        <div className="sum-job-card__header-left">
          <span className="sum-job-card__index">#{index + 1}</span>
          <div className="sum-job-card__id-block">
            <span className="sum-job-card__id">{job.serialjobno || job.id}</span>
            {job.design && <span className="sum-job-card__meta">{job.design}</span>}
          </div>
          <span className={`sum-job-card__badge ${!hasEntries ? 'sum-job-card__badge--empty' : ''}`}>
            {hasEntries ? `${visibleEntries.length} bag${visibleEntries.length !== 1 ? 's' : ''}` : 'No entries'}
          </span>
        </div>

        <div className="sum-job-card__header-right">
          {hasEntries && (
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

      {/* Body */}
      {open && (
        <div className="sum-job-card__body">
          {!hasEntries ? (
            <div className="sum-job-card__empty">No bag entries recorded for this job.</div>
          ) : (
            <>
              {visibleEntries.map((bag, idx) => (
                <BagEntryRow key={bag.rfbag || idx} bag={bag} idx={idx} />
              ))}


              {/* Totals footer */}
              {visibleEntries.length > 1 && (
                <div className="sum-job-card__footer">
                  <span className="sum-job-card__footer-label">Job Total</span>
                  <div className="sum-job-card__footer-vals">
                    {reqPcs > 0 && (
                      <span className="sum-job-card__footer-req">Req: {reqPcs} pcs · {reqWt.toFixed(3)} ctw</span>
                    )}
                    <span className="sum-job-card__footer-entered">{jobPcs} pcs · {jobWt.toFixed(3)} ctw</span>
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
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const jobverification = sessionStorage.getItem('jobverification');
  useEffect(() => { actions.setStep(jobverification === 'true' ? 4 : 7); }, []); // eslint-disable-line
  const allBags = Object.values(state.jobEntries || {}).flatMap(job => job.bags || [])
    .map((b) => ({
      ...b,
      pcs: Number(b.pcs) || 0,
      wt: Number(b.wt) || 0,
    }))
    .filter((b) => !(b.pcs === 0 && b.wt === 0));
  const totalJobs = state.scannedJobs?.length || 0;
  const totalBags = allBags.length;
  const totalPcs = allBags.reduce((s, b) => s + b.pcs, 0);
  const totalWt = allBags.reduce((s, b) => s + b.wt, 0);

  const processLabel = PROCESS_LABELS[state.processSubType] || state.processSubType || '—';
  const materialLabel = state.materialType ? materialTypeLabel(state.materialType) : '—';

  const getJobEntries = (job) => {
    const perJob = state.jobEntries?.[job.id]?.bags;
    if (perJob?.length) return perJob;
    const norm = (s) => String(s ?? '').trim().toUpperCase();
    const bulkBags = state.jobEntries?.['bulk-material']?.bags || [];
    return bulkBags.filter((b) => {
      if (norm(b.serialjobno ?? '') === norm(job.id)) return true;
      const rk = norm(b.rowKey ?? '');
      return rk.startsWith(norm(job.id) + '||');
    });
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

        {/* Totals inline */}
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

      {/* ── Scrollable Body ── */}
      <div className="summary__body">

        {/* Job Entries */}
        <div className="summary__section">
          <div className="summary__section-header">
            <span className="summary__section-title">Job Entries</span>
            <span className="summary__section-count">{totalJobs}</span>
          </div>

          {totalJobs === 0 ? (
            <div className="summary__empty">
              <ScanLine size={28} />
              <span>No jobs were scanned in this session.</span>
            </div>
          ) : (
            <div className="summary__jobs-list">
              {state.scannedJobs.map((job, idx) => (
                <JobCard
                  key={job.id}
                  job={job}
                  entries={getJobEntries(job)}
                  index={idx}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Actions ── */}
      <div className="summary__actions">
        <Button
          variant="outlined"
          onClick={() => jobverification === 'true' ? navigate('/job-verification') : navigate('/material-entry')}
          startIcon={<ArrowLeft size={18} />}
          className="summary__back-btn"
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => navigate('/confirmation')}
          endIcon={<ArrowRight size={20} />}
          className="summary__continue-btn"
        >
          Save &amp; Continue
        </Button>
      </div>

    </div>
  );
};

export default Summary;