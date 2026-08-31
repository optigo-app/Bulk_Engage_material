import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ArrowLeft, ArrowRight, User, Lock, Layers, Package,
  ScanLine, CheckCircle2, Gem, Palette, Wrench,
  ChevronDown, ChevronUp, Hash, Weight,
} from 'lucide-react';
import Button from '@mui/material/Button';
import './Summary.scss';

const PROCESS_LABELS = {
  'single-single': 'Single → Single',
  'single-bulk': 'Single → Bulk',
  'bulk-single': 'Bulk → Single',
  'bulk-bulk': 'Bulk → Bulk RM',
};

const MATERIAL_LABELS = {
  all: 'All',
  diamond: 'Diamond',
  colorstone: 'Colorstone',
  misc: 'Misc / Findings',
  Solitore: 'Diamond:S',
};

const getMaterialColor = (material) => {
  const m = (material || '').toLowerCase();
  if (m.includes('solitore') || m.includes('solitaire')) return '#6343f1';
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
  const pcsOk = bag.reqPcs > 0 ? Number(bag.pcs) <= Number(bag.reqPcs) : true;
  const wtOk = bag.reqWt > 0 ? Number(bag.wt) <= Number(bag.reqWt) : true;
  const bagLabel = bag.rfbag || bag.bagNo || bag.bagId || `Bag ${idx + 1}`;

  return (
    <div className="sum-bag-entry">
      {/* Left: bag id + material */}
      <div className="sum-bag-entry__left">
        <span className="sum-bag-entry__bagno">{bagLabel}</span>
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
            {bag.reqPcs != null ? bag.reqPcs : '—'} pcs
          </span>
          <span className="sum-bag-entry__stat-val">
            {bag.reqWt != null ? Number(bag.reqWt).toFixed(3) : '—'} ctw
          </span>
        </div>

        {/* Divider */}
        <div className="sum-bag-entry__divider" />

        {/* Entered */}
        <div className="sum-bag-entry__stat-group sum-bag-entry__stat-group--entered">
          <span className="sum-bag-entry__stat-label sum-bag-entry__stat-label--entered">Entered</span>
          <span className={`sum-bag-entry__stat-val sum-bag-entry__stat-val--entered ${!pcsOk ? 'sum-bag-entry__stat-val--over' : ''}`}>
            {bag.pcs != null ? bag.pcs : '—'} pcs
          </span>
          <span className={`sum-bag-entry__stat-val sum-bag-entry__stat-val--entered ${!wtOk ? 'sum-bag-entry__stat-val--over' : ''}`}>
            {bag.wt != null ? Number(bag.wt).toFixed(3) : '—'} ctw
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Job Card (collapsible) ───────────────────────────────────
const JobCard = ({ job, entries, index }) => {
  const [open, setOpen] = React.useState(true);
  const jobPcs = entries.reduce((s, b) => s + (Number(b.pcs) || 0), 0);
  const jobWt = entries.reduce((s, b) => s + (Number(b.wt) || 0), 0);
  const reqPcs = entries.reduce((s, b) => s + (Number(b.reqPcs) || 0), 0);
  const reqWt = entries.reduce((s, b) => s + (Number(b.reqWt) || 0), 0);
  const hasEntries = entries.length > 0;

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
            {hasEntries ? `${entries.length} bag${entries.length !== 1 ? 's' : ''}` : 'No entries'}
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
              {entries.map((bag, idx) => (
                <BagEntryRow key={bag.rfbag || idx} bag={bag} idx={idx} />
              ))}

              {/* Totals footer */}
              {entries.length > 1 && (
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
  useEffect(() => { actions.setStep(7); }, []); // eslint-disable-line
  const allBags = Object.values(state.jobEntries || {}).flatMap(job => job.bags || []);
  const totalJobs = state.scannedJobs?.length || 0;
  const totalBags = allBags.length;
  const totalPcs = allBags.reduce((s, b) => s + (Number(b.pcs) || 0), 0);
  const totalWt = allBags.reduce((s, b) => s + (Number(b.wt) || 0), 0);

  const processLabel = PROCESS_LABELS[state.processSubType] || state.processSubType || '—';
  const materialLabel = MATERIAL_LABELS[state.materialType] || state.materialType || '—';

  const getJobEntries = (job) => {
    const perJob = state.jobEntries?.[job.id]?.bags;
    if (perJob?.length) return perJob;
    return (state.jobEntries?.['bulk-material']?.bags || [])
      .filter(b => String(b.jid) === String(job.jid ?? '') || (b.rowKey && job.id));
  };

  return (
    <div className="summary page-enter">
      {/* ── Header ── */}
      <div className="summary__header">
        <div className="summary__step-badge">Step 7</div>
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
            <Package size={13} />
            <span>{totalBags} Bag{totalBags !== 1 ? 's' : ''}</span>
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

        {/* Scanned Bags chips */}
        {state.scannedBags?.length > 0 && (
          <div className="summary__section">
            <div className="summary__section-header">
              <span className="summary__section-title">Scanned Bags</span>
              <span className="summary__section-count">{state.scannedBags.length}</span>
            </div>
            <div className="summary__scanned-chips">
              {state.scannedBags.map(bag => (
                <span key={bag.id} className="summary__scanned-chip">
                  {bag.rfbag || bag.id}
                  {bag.type && <em>{bag.type}</em>}
                </span>
              ))}
            </div>
          </div>
        )}

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
          Save &amp; Process
        </Button>
      </div>

    </div>
  );
};

export default Summary;