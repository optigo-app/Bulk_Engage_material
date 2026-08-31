import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ScanLine, ArrowLeft, ArrowRight, RotateCcw, CheckCircle2,
  AlertCircle, Gem, Palette, Wrench, Stone, Package,
} from 'lucide-react';
import Button from '@mui/material/Button';
import { getMaster } from '../../Utils/masterStore';
import { CallApi } from '../../API/CallApi/CallApi';
import '../MaterialEntry/BulkSingleEntry/Bulksingleentry.scss';
import './JobVerification.scss';

const norm = (s) => String(s ?? '').trim().toUpperCase();
const isSolitaire = (m) => Number(m?.is_sol_gem) === 1;
const getEngagedMaterial = () => getMaster('allEngagedMaterial', []);

const itemName = (itemid, isSol = false) =>
  (itemid === 3 && isSol) ? 'DIAMOND:S' :
  itemid === 3 ? 'DIAMOND' : itemid === 4 ? 'COLORSTONE' : itemid === 5 ? 'FINDING' : 'MISC';

const matColor = (item = '', isSol = false) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return '#6343f1';
  if (u.includes('DIAMOND')) return '#e91e63';
  if (u.includes('COLORSTONE')) return '#9c27b0';
  return '#ff9800';
};

const matIcon = (item = '', isSol = false, size = 13) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return <Stone size={size} />;
  if (u.includes('DIAMOND')) return <Gem size={size} />;
  if (u.includes('COLORSTONE')) return <Palette size={size} />;
  if (u.includes('FINDING')) return <Wrench size={size} />;
  return <Package size={size} />;
};

const matLabel = (item = '', isSol = false) => {
  const u = item.toUpperCase();
  if (u.includes('DIAMOND:S')) return 'Diamond:S';
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

  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef(null);

  const allEngaged = useMemo(() => getEngagedMaterial(), []);

  useEffect(() => {
    actions.setStep(2);
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
      setError(`No engaged material found for job "${serial}".`);
      setScanValue('');
      inputRef.current?.focus();
      return;
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

  const handleContinueToSummary = async () => {
    if (!job) return;
    if (hasAnyErrors) return;

    const reportData = (() => {
      try { return JSON.parse(sessionStorage.getItem('reportVarible') || '{}'); }
      catch { return {}; }
    })();
    const appuserid = atob(reportData?.LUId || '');
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

    const bags = job.rows
      .filter((r) => hasTxn(r.txnid) && returnedTxns.has(r.txnid) && !returnAllTxns.has(r.txnid))
      .map((r) => {
        const item = r.item || itemName(r.itemid, isSolitaire(r));
        const inp = inputs[r.txnid] || {
          pcs: String(r.isspcs ?? ''),
          cwt: Number(r.isswt ?? 0).toFixed(3),
        };

        // Partial return: original - entered = remaining to keep engaged
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
          bag: r.rfbag ? { rfbag: r.rfbag } : null,
          item,
          itemid: r.itemid,
          material: item,
          shape: r.shape || '',
          quality: r.Quality || '',
          color: r.color || '',
          size: r.Size || '',
          findingtypename: r.findingtypename || '',
          findingAccessories: r.findingAccessories || '',
          iscompany: r.iscompany,
          pcs: remainingPcs,   // original - returned = remaining
          wt: remainingWt,     // original - returned = remaining
          reqPcs: origPcs,
          reqWt: origWt,
          requiredPcs: origPcs,
          requiredWt: origWt,
          rowKey: `${norm(item)}|${norm(r.shape)}|${norm(r.Quality)}|${norm(r.color)}|${norm(r.Size)}`,
          desc: [r.shape, r.Quality, r.color, r.Size].filter(Boolean).join(' · '),
          isUnusedBag: false,
        };
      });

    actions.setScannedJobs([{
      id: job.serialjobno,
      serialjobno: job.serialjobno,
      jid: resolvedJid,
      ccode: job.rows[0]?.ccode ?? '',
    }]);

    actions.updateJobEntry('bulk-material', { bags });
    navigate('/summary');
  };

  const pills = useMemo(() => {
    if (!job) return [];
    const groups = {};
    job.rows.forEach((r) => {
      const item = r.item || itemName(r.itemid, isSolitaire(r));
      if (!groups[item]) groups[item] = { pcs: 0, wt: 0, isSol: isSolitaire(r) };
      groups[item].pcs += Number(r.isspcs || 0);
      groups[item].wt += Number(r.isswt || 0);
    });
    return Object.entries(groups);
  }, [job]);

  const anyAction = returnedTxns.size > 0 || returnAllTxns.size > 0;

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
          <div className="job-verify__title-block">
            <span className="job-verify__title">Job Verification — Return Material</span>
            <span className="job-verify__sub">Scan a job to view and return its engaged material.</span>
          </div>
          {returnedTxns.size > 0 && (
            <span className="job-verify__returned-note">
              <CheckCircle2 size={13} />
              {returnedTxns.size} entr{returnedTxns.size === 1 ? 'y' : 'ies'} unlocked
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="job-verify__error"><AlertCircle size={13} /> {error}</div>
      )}

      <div className="job-verify__body">
        {!job ? (
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
                  <span key={item} className="bse-pill" style={{ '--pc': matColor(item, v.isSol) }}>
                    <b>{matLabel(item, v.isSol)}</b>{v.wt.toFixed(3)} ctw · {v.pcs} pcs
                  </span>
                ))}
              </div>
              <div className="bse-job-hdr__right">
                <span className="bse-badge">{job.rows.length} lines</span>
              </div>
            </div>

            {/* Table */}
            <div className="bse-table-wrap">
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
                    <th className="bse-th bse-th--sub" style={{width: '220px'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {job.rows.map((r, idx) => {
                    const item = r.item || itemName(r.itemid, isSolitaire(r));
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
                          <span className="bse-mat" style={{ color: matColor(item, isSolitaire(r)) }}>
                            {matIcon(item, isSolitaire(r))}{r.MaterialTypeName || matLabel(item, isSolitaire(r))}
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
                            <span className="bse-chip bse-chip--none">No bag</span>
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
          onClick={handleContinueToSummary}
          disabled={!anyAction || hasAnyErrors}
          endIcon={<ArrowRight size={20} />}
          className="job-verify__continue-btn"
        >
          Continue to Summary
        </Button>
      </div>
    </div>
  );
};

export default JobVerification;