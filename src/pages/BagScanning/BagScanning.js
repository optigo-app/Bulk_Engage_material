import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ScanLine,
  ArrowLeft,
  ArrowRight,
  Package,
  CheckCircle2,
  AlertTriangle,
  PackagePlus,
  Gem,
  Palette,
  Wrench,
} from 'lucide-react';
import Button from '@mui/material/Button';
import './BagScanning.scss';

// ─────────────────────────────────────────────────────────────
// sessionStorage helpers
// ─────────────────────────────────────────────────────────────
const getSessionData = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// Item label / icon / color
// ─────────────────────────────────────────────────────────────
const getItemLabel = (itemid) => {
  switch (itemid) {
    case 3: return 'Diamond';
    case 4: return 'Colorstone';
    case 5: return 'Finding / Misc';
    default: return 'Unknown';
  }
};

const getItemIcon = (itemid) => {
  switch (itemid) {
    case 3: return Gem;
    case 4: return Palette;
    case 5: return Wrench;
    default: return Package;
  }
};

const getItemColor = (itemid) => {
  switch (itemid) {
    case 3: return '#e91e63';
    case 4: return '#9c27b0';
    case 5: return '#ff9800';
    default: return '#607d8b';
  }
};

// ─────────────────────────────────────────────────────────────
// matchBagsForItem — exact match on itemid+shape+Quality+color+size
// Returns allBagListData rows that satisfy this material line
// ─────────────────────────────────────────────────────────────
const matchBagsForItem = (jobMaterial, allBags) => {
  const jobSize = jobMaterial.size || jobMaterial.customsize || '';
  return allBags.filter((bag) => {
    const bagSize = bag.Size || bag.customesize || '';
    return (
      bag.itemid    === jobMaterial.itemid &&
      bag.shape     === jobMaterial.shape  &&
      bag.Quality   === jobMaterial.Quality &&
      bag.color     === jobMaterial.color  &&
      bagSize       === jobSize
    );
  });
};

const matchFindingBags = (jobMaterial, allBags) => {
  return allBags.filter((bag) => (
    bag.itemid             === jobMaterial.itemid &&
    bag.shape              === jobMaterial.shape  &&
    bag.Quality            === jobMaterial.Quality &&
    bag.color              === jobMaterial.color  &&
    (bag.findingtypename   || '') === (jobMaterial.findingtypename   || '') &&
    (bag.findingAccessories || '') === (jobMaterial.findingAccessories || '')
  ));
};

// ─────────────────────────────────────────────────────────────
// buildRequiredBags
//   scannedJobMaterialData  →  each line is one material spec
//   allBagListData          →  physical bags in lockers
//   Result: flat array of bag entries, each carrying its
//           parent material for display
// ─────────────────────────────────────────────────────────────
const buildRequiredBags = () => {
  const materialLines = getSessionData('scannedJobMaterialData'); // [{qid,jid,itemid,shape,Quality,color,size,...}]
  const allBags       = getSessionData('allBagListData');         // [{rfbag,itemid,shape,Quality,color,Size,...}]

  if (!materialLines.length || !allBags.length) return [];

  const result = [];

  materialLines.forEach((material) => {
    // Choose matcher — findings use findingtypename/findingAccessories instead of size
    const isFinding = material.itemid === 5;
    const matchedBags = isFinding
      ? matchFindingBags(material, allBags)
      : matchBagsForItem(material, allBags);

    matchedBags.forEach((bag) => {
      // Avoid duplicates (same rfbag matched by multiple material lines)
      const alreadyAdded = result.find((r) => r.id === bag.rfbag);
      if (!alreadyAdded) {
        result.push({
          // ── identity ──
          id:       bag.rfbag,
          rfbag:    bag.rfbag,

          // ── bag physical data ──
          itemid:   bag.itemid,
          type:     getItemLabel(bag.itemid),
          color:    getItemColor(bag.itemid),   // UI accent color
          shape:    bag.shape,
          quality:  bag.Quality,
          size:     bag.Size || bag.customesize || '',
          color_name:       bag.color,
          findingtypename:  bag.findingtypename  || '',
          findingAccessories: bag.findingAccessories || '',
          remwt:    bag.remwt,
          rempcs:   bag.rempcs,
          LockerName: bag.LockerName,
          iscompany:  bag.iscompany,
          istoreCust_CustName: bag.istoreCust_CustName,

          // ── parent material line (for display & traceability) ──
          qid:             material.qid,
          jid:             material.jid,
          SerialJobNo:     material.SerialJobNo,
          QuotationNo:     material.QuotationNo,
          materialWt:      material.wt,
          materialPcs:     material.pcs,
          materialShape:   material.shape,
          materialQuality: material.Quality,
          materialColor:   material.color,
          materialSize:    material.size || material.customsize || '',
        });
      }
    });
  });

  return result;
};

// ─────────────────────────────────────────────────────────────
const BagScanning = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [scanValue, setScanValue]           = useState('');
  const [lastScanned, setLastScanned]       = useState(null);
  const [otherBags, setOtherBags]           = useState([]);
  const [lastOtherScanned, setLastOtherScanned] = useState(null);
  // bagData[rfbag] = { pcs, cwt }  — always disabled (pre-filled, read-only)
  const [bagData, setBagData]               = useState({});
  const [listVisible, setListVisible]       = useState(true);
  const [bagFilter, setBagFilter]           = useState('all');

  const inputRef         = useRef(null);
  const highlightTimerRef = useRef(null);
  const listTimerRef      = useRef(null);

  // ── Build required bags once on mount ──
  useEffect(() => {
    actions.setStep(5);
    if (state.scannedJobs.length === 0) navigate('/scan-jobs');

    const required = buildRequiredBags();
    actions.setRequiredBags(required);

    inputRef.current?.focus();
  }, []);

  // ── Clear highlight after 2s ──
  useEffect(() => {
    if (lastScanned || lastOtherScanned) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setLastScanned(null);
        setLastOtherScanned(null);
      }, 2000);
    }
    return () => clearTimeout(highlightTimerRef.current);
  }, [lastScanned, lastOtherScanned]);

  // ─────────────────────────────────────────────────────────────
  // Scan handler
  // ─────────────────────────────────────────────────────────────
  const handleScan = () => {
    const val = scanValue.trim();
    if (!val) return;

    // Is it a required bag?
    const bag = state.requiredBags.find((b) => b.rfbag === val || b.id === val);

    if (bag) {
      // Already scanned? ignore
      if (!state.scannedBags.find((b) => b.id === bag.id)) {
        actions.addScannedBag(bag);
        setLastScanned(bag.id);
        setLastOtherScanned(null);

        // Pre-fill from bag's remwt / rempcs — DISABLED (read-only)
        setBagData((prev) => ({
          ...prev,
          [bag.id]: {
            pcs: bag.rempcs !== undefined ? String(bag.rempcs) : '',
            cwt: bag.remwt  !== undefined ? String(bag.remwt)  : '',
          },
        }));

        // Animate list
        setListVisible(false);
        clearTimeout(listTimerRef.current);
        listTimerRef.current = setTimeout(() => setListVisible(true), 600);
      }
    } else {
      // Not in required list → Other Bags
      if (!otherBags.find((b) => b.id === val)) {
        setOtherBags((prev) => [
          ...prev,
          { id: val, label: val, type: 'unknown', color: '#ef4444' },
        ]);
        setLastOtherScanned(val);
        setLastScanned(null);
      }
    }

    setScanValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  // ─────────────────────────────────────────────────────────────
  // Continue → save scannedBagData to sessionStorage
  // ─────────────────────────────────────────────────────────────
  const handleContinue = () => {
    if (state.scannedBags.length === 0) return;

    // Build enriched payload: bag info + user-entered (or pre-filled) pcs/cwt
    const scannedBagData = state.scannedBags.map((bag) => ({
      // bag identity & specs
      rfbag:           bag.rfbag,
      itemid:          bag.itemid,
      type:            bag.type,
      shape:           bag.shape,
      quality:         bag.quality,
      size:            bag.size,
      color_name:      bag.color_name,
      LockerName:      bag.LockerName,
      iscompany:       bag.iscompany,
      istoreCust_CustName: bag.istoreCust_CustName,
      findingtypename: bag.findingtypename,
      findingAccessories: bag.findingAccessories,

      // scanned quantities (from bagData state, pre-filled from remwt/rempcs)
      scannedPcs: bagData[bag.id]?.pcs ?? '',
      scannedCwt: bagData[bag.id]?.cwt ?? '',

      // traceability back to job material line
      qid:         bag.qid,
      jid:         bag.jid,
      SerialJobNo: bag.SerialJobNo,
      QuotationNo: bag.QuotationNo,

      // material spec the bag was matched against
      materialWt:      bag.materialWt,
      materialPcs:     bag.materialPcs,
      materialShape:   bag.materialShape,
      materialQuality: bag.materialQuality,
      materialColor:   bag.materialColor,
      materialSize:    bag.materialSize,
    }));

    sessionStorage.setItem('scannedBagData', JSON.stringify(scannedBagData));
    navigate('/material-entry');
  };
  
  const isScanned = (bagId) => state.scannedBags.some((b) => b.id === bagId);
  const filteredBags = useMemo(() => {
    return state.requiredBags.filter((bag) => {
      if (bagFilter === 'all')      return true;
      if (bagFilter === 'company')  return bag.iscompany === 1;
      if (bagFilter === 'customer') return bag.iscompany === 0;
      return true;
    });
  }, [state.requiredBags, bagFilter]);

  const scannedCount  = state.scannedBags.length;
  const requiredCount = state.requiredBags.length;
  const missingCount  = requiredCount - scannedCount;
  const extraCount    = otherBags.length;
  const progressPct   = requiredCount > 0 ? (scannedCount / requiredCount) * 100 : 0;

  return (
    <div className="bag-scanning page-enter">

      {/* ─── Header ─── */}
      <div className="bag-scanning__header">
        <div className="bag-scanning__step-badge">Step 5</div>
        <h1 className="bag-scanning__title">Bag Scanning</h1>
        <p className="bag-scanning__desc">Scan the required bags for the scanned jobs</p>
      </div>

      <div className="bag-scanning__layout">
        <div className="bag-scanning__left">

          {/* Jobs in scope chips */}
          {state.scannedJobs.length > 0 && (
            <div className="bag-scanning__jobs-context">
              <span className="bag-scanning__jobs-context-label">Jobs in scope:</span>
              <div className="bag-scanning__jobs-chips">
                {state.scannedJobs.map((j) => (
                  <span key={j.id} className="bag-scanning__job-chip">{j.id}</span>
                ))}
              </div>
            </div>
          )}

          {/* Summary card */}
          <div className="bag-scanning__info-card">
            <h3>Scan Summary</h3>
            <div className="bag-scanning__summary-grid">
              <div className="bag-scanning__summary-item bag-scanning__summary-item--scanned">
                <span className="bag-scanning__summary-value">{scannedCount}</span>
                <span className="bag-scanning__summary-label">Scanned</span>
              </div>
              <div className="bag-scanning__summary-item bag-scanning__summary-item--required">
                <span className="bag-scanning__summary-value">{requiredCount}</span>
                <span className="bag-scanning__summary-label">Required</span>
              </div>
              <div className="bag-scanning__summary-item bag-scanning__summary-item--missing">
                <span className="bag-scanning__summary-value">{missingCount}</span>
                <span className="bag-scanning__summary-label">Missing</span>
              </div>
              <div className="bag-scanning__summary-item bag-scanning__summary-item--extra">
                <span className="bag-scanning__summary-value">{extraCount}</span>
                <span className="bag-scanning__summary-label">Extra</span>
              </div>
            </div>
            <div className="bag-scanning__progress-bar">
              <div
                className="bag-scanning__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="bag-scanning__progress-label">
              {scannedCount}/{requiredCount} bags scanned
            </div>
          </div>

          {/* Scan input */}
          <div className="bag-scanning__scan-area">
            <div className="bag-scanning__scan-frame">
              <div className="bag-scanning__scan-animation">
                <div className="bag-scanning__scan-box"><Package size={28} /></div>
                <div className="bag-scanning__scan-pulse"></div>
                <div className="bag-scanning__scan-pulse bag-scanning__scan-pulse--delayed"></div>
              </div>
              <span>Scan Bag</span>
            </div>
            <div className="bag-scanning__input-wrapper">
              <ScanLine size={16} className="bag-scanning__input-icon" />
              <input
                ref={inputRef}
                type="text"
                className="bag-scanning__input"
                placeholder="Scan bag barcode (e.g. 0000002988)..."
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleScan}
                disabled={!scanValue.trim()}
                className="bag-scanning__scan-btn"
              >
                Scan
              </Button>
            </div>
          </div>

          {state.requiredBags.length === 0 && (
            <div className="bag-scanning__no-bags">
              <AlertTriangle size={28} />
              <p>No matching bags found for the scanned job material(s).</p>
              <span>Verify job selection or check bag data.</span>
            </div>
          )}
        </div>

        {/* ── RIGHT — Required Bags + Other Bags ── */}
        <div className="bag-scanning__right">

          <div className="bag-scanning__section">
            <div className="bag-scanning__bags-header">
              <h3>Required Bags</h3>
              <span className="bag-scanning__bags-count">{scannedCount}/{requiredCount}</span>
            </div>

            {/* Filter pills: All / Company / Customer */}
            <div className="bag-scanning__filter-pills">
              {['all', 'company', 'customer'].map((f) => (
                <button
                  key={f}
                  className={[
                    'bag-scanning__filter-pill',
                    bagFilter === f ? 'bag-scanning__filter-pill--active' : '',
                  ].join(' ')}
                  onClick={() => setBagFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'company' ? 'Company' : 'Customer'}
                </button>
              ))}
            </div>

            <div className={`bag-scanning__bags-list ${listVisible ? 'bag-scanning__bags-list--visible' : 'bag-scanning__bags-list--hidden'}`}>
              {filteredBags.length === 0 ? (
                <div className="bag-scanning__empty-list">
                  <Package size={24} />
                  <span>No bags for this filter.</span>
                </div>
              ) : (
                filteredBags.map((bag) => {
                  const scanned     = isScanned(bag.id);
                  const justScanned = lastScanned === bag.id;
                  const Icon        = getItemIcon(bag.itemid);

                  return (
                    <div
                      key={bag.id}
                      className={[
                        'bag-scanning__bag-card',
                        scanned     ? 'bag-scanning__bag-card--scanned'      : '',
                        justScanned ? 'bag-scanning__bag-card--just-scanned' : '',
                      ].join(' ')}
                    >
                      {/* Icon */}
                      <div
                        className="bag-scanning__bag-icon"
                        style={{ '--bag-color': bag.color }}
                      >
                        {scanned ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                      </div>

                      {/* Info */}
                      <div className="bag-scanning__bag-info">
                        <span className="bag-scanning__bag-id">{bag.rfbag}</span>
                        <span className="bag-scanning__bag-type">
                          {bag.type} · {bag.shape} · {bag.quality} · {bag.size}
                        </span>
                        <span className="bag-scanning__bag-meta">
                          Color: {bag.color_name}
                          {bag.LockerName ? ` · ${bag.LockerName}` : ''}
                          {bag.istoreCust_CustName ? ` · ${bag.istoreCust_CustName}` : ''}
                        </span>
                        {/* Material line it was matched from */}
                        <span className="bag-scanning__bag-meta">
                          Job: {bag.SerialJobNo} · Req: {bag.materialPcs} pcs / {bag.materialWt} ct
                        </span>
                      </div>

                      {/* Status badge */}
                      <div className="bag-scanning__bag-status">
                        {scanned ? (
                          <span className="bag-scanning__bag-badge bag-scanning__bag-badge--scanned">
                            Scanned
                          </span>
                        ) : (
                          <span className="bag-scanning__bag-badge bag-scanning__bag-badge--pending">
                            Pending
                          </span>
                        )}
                      </div>

                      {/* ── PCS / CWT inputs — visible after scan, always DISABLED ── */}
                      {scanned && (
                        <div className="bag-scanning__bag-inputs">
                          <div className="bag-scanning__bag-field-wrap">
                            <label>Rem. PCS</label>
                            <input
                              type="number"
                              className="bag-scanning__bag-field bag-scanning__bag-field--disabled"
                              value={bagData[bag.id]?.pcs ?? ''}
                              disabled
                              readOnly
                            />
                          </div>
                          <div className="bag-scanning__bag-field-wrap">
                            <label>Rem. Wt (ct)</label>
                            <input
                              type="number"
                              step="0.001"
                              className="bag-scanning__bag-field bag-scanning__bag-field--disabled"
                              value={bagData[bag.id]?.cwt ?? ''}
                              disabled
                              readOnly
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Other / Extra Bags */}
          {otherBags.length > 0 && (
            <div className="bag-scanning__section bag-scanning__section--others">
              <div className="bag-scanning__bags-header bag-scanning__bags-header--others">
                <h3><AlertTriangle size={16} />&nbsp;Other Bags</h3>
                <span className="bag-scanning__bags-count bag-scanning__bags-count--others">
                  {otherBags.length}
                </span>
              </div>
              <div className="bag-scanning__bags-list">
                {otherBags.map((bag) => {
                  const justScanned = lastOtherScanned === bag.id;
                  return (
                    <div
                      key={bag.id}
                      className={[
                        'bag-scanning__bag-card',
                        'bag-scanning__bag-card--other',
                        justScanned ? 'bag-scanning__bag-card--just-scanned-other' : '',
                      ].join(' ')}
                    >
                      <div className="bag-scanning__bag-icon bag-scanning__bag-icon--other">
                        <PackagePlus size={20} />
                      </div>
                      <div className="bag-scanning__bag-info">
                        <span className="bag-scanning__bag-id">{bag.id}</span>
                        <span className="bag-scanning__bag-type">Not in required list</span>
                      </div>
                      <div className="bag-scanning__bag-status">
                        <span className="bag-scanning__bag-badge bag-scanning__bag-badge--extra">
                          Extra
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="bag-scanning__actions">
        <Button
          variant="outlined"
          onClick={() => navigate('/scan-jobs')}
          startIcon={<ArrowLeft size={18} />}
          className="bag-scanning__back-btn"
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleContinue}
          disabled={state.scannedBags.length === 0}
          endIcon={<ArrowRight size={20} />}
          className="bag-scanning__continue-btn"
        >
          Continue to Material Entry
        </Button>
      </div>
    </div>
  );
};

export default BagScanning;