import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ArrowLeft, ArrowRight, User, Lock, Layers, Package,
  ScanLine, CheckCircle2, Gem, Palette, Wrench,
  ChevronDown, ChevronUp,
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
};

const getMaterialIcon = (material, size = 14) => {
  const m = (material || '').toLowerCase();
  if (m.includes('diamond')) return <Gem size={size} />;
  if (m.includes('colorstone')) return <Palette size={size} />;
  if (m.includes('finding') || m.includes('misc')) return <Wrench size={size} />;
  return <Package size={size} />;
};

const getMaterialColor = (material) => {
  const m = (material || '').toLowerCase();
  if (m.includes('diamond')) return '#e91e63';
  if (m.includes('colorstone')) return '#9c27b0';
  if (m.includes('finding') || m.includes('misc')) return '#ff9800';
  return '#607d8b';
};

// Builds the material description. For findings, show finding type name /
// accessories; for other materials, show shape · quality · color · size.
const getMaterialDesc = (bag) => {
  const findingPart = [bag.findingtypename, bag.findingAccessories]
    .filter(Boolean)
    .join(' · ');
  const specPart = [bag.shape, bag.quality, bag.color, bag.size]
    .filter(Boolean)
    .join(' · ');
  return [findingPart, specPart].filter(Boolean).join(' · ') || bag.desc || '—';
};

// ─────────────────────────────────────────────────────────────
// Collapsible Job Row
// ─────────────────────────────────────────────────────────────
const JobRow = ({ job, entries }) => {
  const [open, setOpen] = React.useState(true);
  const jobPcs = entries.reduce((s, b) => s + (Number(b.pcs) || 0), 0);
  const jobWt = entries.reduce((s, b) => s + (Number(b.wt) || 0), 0);

  return (
    <div className="sum-job-row">
      {/* Job header */}
      <div className="sum-job-row__header" onClick={() => setOpen((v) => !v)}>
        <div className="sum-job-row__title">
          <span className="sum-job-row__id">{job.id}</span>
          {entries.length > 0 && (
            <span className="sum-job-row__badge">{entries.length} bag{entries.length !== 1 ? 's' : ''}</span>
          )}
          {entries.length === 0 && (
            <span className="sum-job-row__badge sum-job-row__badge--empty">No entries</span>
          )}
        </div>

        <div className="sum-job-row__stats">
          {entries.length > 0 && (
            <>
              <span className="sum-job-row__stat">
                <strong>{jobPcs}</strong> pcs
              </span>
              <span className="sum-job-row__stat">
                <strong>{jobWt.toFixed(3)}</strong> ct
              </span>
            </>
          )}
          <button className="sum-job-row__toggle">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Bag entries */}
      {open && entries.length > 0 && (
        <div className="sum-job-row__body">
          {/* Column headers */}
          <div className="sum-bag-header">
            <span>Bag No.</span>
            <span>Material</span>
            <span className="sum-bag-header__num">Req PCS</span>
            <span className="sum-bag-header__num">Req WT</span>
            <span className="sum-bag-header__num entered">Entered PCS</span>
            <span className="sum-bag-header__num entered">Entered WT</span>
          </div>

          {entries.map((bag, idx) => {
            console.log('bag: ', bag);
            const color = getMaterialColor(bag.material);
            const pcsOk = bag.reqPcs > 0
              ? Number(bag.pcs) <= Number(bag.reqPcs)
              : true;
            const wtOk = bag.reqWt > 0
              ? Number(bag.wt) <= Number(bag.reqWt)
              : true;

            return (
              <div key={bag.rfbag || idx} className="sum-bag-row">
                {/* Bag No */}
                <span className="sum-bag-row__rfbag">{bag.rfbag || bag.bagNo || bag.bagId || '—'}</span>

                {/* Material icon + name */}
                <span className="sum-bag-row__material" style={{ color }}>
                  {getMaterialDesc(bag)}
                </span>

                {/* Required */}
                <span className="sum-bag-row__num">
                  {bag.reqPcs != null ? bag.reqPcs : '—'}
                </span>
                <span className="sum-bag-row__num">
                  {bag.reqWt != null ? bag.reqWt : '—'}
                </span>

                {/* Entered PCS */}
                <span className={`sum-bag-row__num sum-bag-row__entered ${pcsOk ? '' : 'sum-bag-row__entered--over'}`}>
                  {bag.pcs != null ? bag.pcs : '—'}
                </span>

                {/* Entered WT */}
                <span className={`sum-bag-row__num sum-bag-row__entered ${wtOk ? '' : 'sum-bag-row__entered--over'}`}>
                  {bag.wt != null ? Number(bag.wt).toFixed(3) : '—'}
                </span>
              </div>
            );
          })}

          {/* Job totals row */}
          <div className="sum-bag-row sum-bag-row--total">
            <span className="sum-bag-row__rfbag">Total</span>
            <span></span>
            <span className="sum-bag-row__num">
              {entries.reduce((s, b) => s + (Number(b.reqPcs) || 0), 0)}
            </span>
            <span className="sum-bag-row__num">
              {entries.reduce((s, b) => s + (Number(b.reqWt) || 0), 0).toFixed(3)}
            </span>
            <span className="sum-bag-row__num sum-bag-row__entered">
              {jobPcs}
            </span>
            <span className="sum-bag-row__num sum-bag-row__entered">
              {jobWt.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {open && entries.length === 0 && (
        <div className="sum-job-row__empty">No bag entries recorded for this job.</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Summary Component
// ─────────────────────────────────────────────────────────────
const Summary = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  console.log('state: ', state);

  useEffect(() => {
    actions.setStep(7);
  }, []);

  // ── Computed totals ──
  const allBags = Object.values(state.jobEntries || {}).flatMap(
    (job) => job.bags || []
  );

  const totalJobs = state.scannedJobs?.length || 0;
  const totalBags = allBags.length;
  const totalEntries = totalBags;
  const totalPcs = allBags.reduce((s, b) => s + (Number(b.pcs) || 0), 0);
  const totalWt = allBags.reduce((s, b) => s + (Number(b.wt) || 0), 0);

  // ── Material breakdown ──
  const byMaterial = allBags.reduce((acc, bag) => {
    const key = bag.material || 'Unknown';
    if (!acc[key]) acc[key] = { pcs: 0, wt: 0, count: 0 };
    acc[key].pcs += Number(bag.pcs) || 0;
    acc[key].wt += Number(bag.wt) || 0;
    acc[key].count += 1;
    return acc;
  }, {});

  const processLabel = PROCESS_LABELS[state.processSubType] || state.processSubType || '—';
  const materialLabel = MATERIAL_LABELS[state.materialType] || state.materialType || '—';

  return (
    <div className="summary page-enter">

      {/* ── Header ── */}
      <div className="summary__header">
        <div className="summary__step-badge">Step 7</div>
        <h1 className="summary__title">Summary</h1>
        <p className="summary__desc">Review all details before final processing</p>
      </div>

      {/* ── Info Cards ── */}
      <div className="summary__cards-grid">
        <div className="summary__card">
          <div className="summary__card-icon summary__card-icon--blue">
            <User size={18} />
          </div>
          <div className="summary__card-content">
            <span className="summary__card-label">Employee</span>
            <strong>{state.employee?.name || 'N/A'}</strong>
            <span className="summary__card-sub">{state.employee?.code || ''}</span>
          </div>
        </div>

        <div className="summary__card">
          <div className="summary__card-icon summary__card-icon--green">
            <Lock size={18} />
          </div>
          <div className="summary__card-content">
            <span className="summary__card-label">Locker</span>
            <strong>{state.locker?.name || 'N/A'}</strong>
            <span className="summary__card-sub">{state.locker?.code || ''}</span>
          </div>
        </div>

        <div className="summary__card">
          <div className="summary__card-icon summary__card-icon--orange">
            <Layers size={18} />
          </div>
          <div className="summary__card-content">
            <span className="summary__card-label">Process</span>
            <strong>{processLabel}</strong>
            <span className="summary__card-sub">{materialLabel}</span>
          </div>
        </div>

        <div className="summary__card">
          <div className="summary__card-icon summary__card-icon--purple">
            <Package size={18} />
          </div>
          <div className="summary__card-content">
            <span className="summary__card-label">Stats</span>
            <strong>{totalJobs} Job{totalJobs !== 1 ? 's' : ''}</strong>
            <span className="summary__card-sub">{totalBags} Bag{totalBags !== 1 ? 's' : ''} · {totalEntries} Entries</span>
          </div>
        </div>
      </div>

      {/* ── Grand Totals Bar ── */}
      <div className="summary__totals">
        <div className="summary__total-item">
          <ScanLine size={16} />
          <span>Total Jobs</span>
          <strong>{totalJobs}</strong>
        </div>
        <div className="summary__total-item">
          <Package size={16} />
          <span>Total Bags</span>
          <strong>{totalBags}</strong>
        </div>
        <div className="summary__total-item">
          <CheckCircle2 size={16} />
          <span>Total PCS</span>
          <strong>{totalPcs}</strong>
        </div>
        <div className="summary__total-item summary__total-item--highlight">
          <CheckCircle2 size={16} />
          <span>Total WT (ct)</span>
          <strong>{totalWt.toFixed(3)}</strong>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="summary__body">

        {/* ── Material Breakdown ── */}
        {Object.keys(byMaterial).length > 0 && (
          <div className="summary__breakdown">
            <div className="summary__breakdown-grid">
            </div>
          </div>
        )}

        {/* ── Scanned Bags (from BagScanning step) ── */}
        {state.scannedBags?.length > 0 && (
          <div className="summary__section">
            <h3>Scanned Bags <span className="summary__section-count">{state.scannedBags.length}</span></h3>
            <div className="summary__scanned-chips">
              {state.scannedBags.map((bag) => (
                <span key={bag.id} className="summary__scanned-chip">
                  {bag.rfbag || bag.id}
                  {bag.type && <em>{bag.type}</em>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Job Entries ── */}
        <div className="summary__section">
          <h3>
            Job Entries
            <span className="summary__section-count">{totalJobs}</span>
          </h3>

          {totalJobs === 0 ? (
            <div className="summary__empty">
              <ScanLine size={28} />
              <span>No jobs were scanned in this session.</span>
            </div>
          ) : (
            <div className="summary__jobs-list">
              {state.scannedJobs.map((job) => {
                const entries = state.jobEntries?.[job.id]?.bags || [];
                return (
                  <JobRow key={job.id} job={job} entries={entries} />
                );
              })}
            </div>
          )}
        </div>

      </div>{/* end summary__body */}

      {/* ── Actions ── */}
      <div className="summary__actions">
        <Button
          variant="outlined"
          onClick={() => navigate('/material-entry')}
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