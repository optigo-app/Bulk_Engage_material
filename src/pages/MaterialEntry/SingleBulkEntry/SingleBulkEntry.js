import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ScanLine, Save, CheckCircle2, AlertTriangle,
  PackageOpen, Package, Gem, Palette, Wrench, X, RotateCcw, AlertCircle,
  Plus
} from 'lucide-react';
import Button from '@mui/material/Button';
import './SingleBulkEntry.scss';
import { getMaster, isMasterKey } from '../../../Utils/masterStore';
import { sumSavedBagCwt } from '../../../Utils/globalFunc';

// ─────────────────────────────────────────────────────────────
const getSession = (key) => {
  if (isMasterKey(key)) return getMaster(key, []);
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};


const getMaterialColor = (itemid) => {
  switch (itemid) {
    case 3: return '#e91e63';
    case 4: return '#9c27b0';
    case 5: return '#ff9800';
    default: return '#607d8b';
  }
};

const norm = (s) => String(s ?? '').trim().toUpperCase();

const getEngagedTotals = (AllEngagedMaterial, serialJobNo, row) => {
  const matches = (AllEngagedMaterial || []).filter(e => {
    if (!e.isengage) return false;
    if (norm(e.serialjobno) !== norm(serialJobNo)) return false;
    if (e.itemid !== row.itemid) return false;
    if (row.itemid === 5) {
      return norm(e.findingtypename || '') === norm(row.findingtypename || '') &&
        norm(e.findingAccessories || '') === norm(row.findingAccessories || '');
    }
    return norm(e.shape || '') === norm(row.shape || '') &&
      norm(e.Quality || '') === norm(row.quality || '') &&
      norm(e.color || '') === norm(row.color || '') &&
      norm(e.Size || '') === norm(row.size || '');
  });
  if (!matches.length) return null;
  const pcs = matches.reduce((s, e) => s + (e.isspcs || 0), 0);
  const wt = matches.reduce((s, e) => s + (e.isswt || 0), 0);
  if (pcs === 0 && wt === 0) return null;
  // Collect distinct txnids from matched engaged rows so we can persist
  // the correct txnid when this engaged amount is saved.
  const txnids = [...new Set(
    matches.map((e) => e.txnid).filter((t) => t !== undefined && t !== null && t !== '')
  )];
  const txnid = txnids.length ? txnids.join(',') : null;
  return { pcs, wt, txnid };
};

// Material type → itemid filter
const MATERIAL_ITEMID_MAP = {
  all: null,
  diamond: [3],
  colorstone: [4],
  misc: [7],
  findings: [5],
};

// Build material rows from scannedJobMaterialData
const buildMaterialRows = (
  serialJobNo, materialType = 'all',
  ScannedMaterials, ScannedBags,
  requiredBags = [], scannedBagsCtx = []
) => {
  const allowedItemIds = MATERIAL_ITEMID_MAP[materialType] ?? null;
  const scannedRfbagSet = new Set(scannedBagsCtx.map((b) => norm(b.rfbag)));
  return ScannedMaterials
    .filter((m) => norm(m.SerialJobNo) === norm(serialJobNo))
    .filter((m) => !allowedItemIds || allowedItemIds.includes(m.itemid))
    .map((m) => {
      const lineRequiredBags = requiredBags.filter(
        (rb) => rb.qid === m.qid && rb.jid === m.jid
      );
      const anyScanned = lineRequiredBags.some((rb) => scannedRfbagSet.has(norm(rb.rfbag)));
      const hasRequired = lineRequiredBags.length > 0;

      const autoMatch =
        ScannedBags.find((b) => b.qid === m.qid && b.jid === m.jid) ||
        ScannedBags.find((b) =>
          b.itemid === m.itemid &&
          norm(b.shape || '') === norm(m.shape || '') &&
          norm(b.quality || '') === norm(m.Quality || '') &&
          norm(b.color_name || '') === norm(m.color || '') &&
          norm(b.size || '') === norm(m.size || '')
        ) || null;

      return {
        qid: m.qid,
        jid: m.jid,
        SerialJobNo: m.SerialJobNo,
        QuotationNo: m.QuotationNo,
        item: m.item || '',
        itemid: m.itemid,
        MaterialTypeName: m.MaterialTypeName || '',
        shape: m.shape || '',
        quality: m.Quality || '',
        color: m.color || '',
        size: m.size || m.customsize || '',
        findingtypename: m.findingtypename || '',
        findingAccessories: m.findingAccessories || '',
        requiredPcs: m.pcs ?? 0,
        requiredWt: m.wt ?? 0,
        isUnusedBag: !hasRequired,
        requiredBagNotScanned: hasRequired && !anyScanned,
        requiredBagRfbag: (hasRequired && !anyScanned) ? lineRequiredBags[0].rfbag : null,
        matchedBag: autoMatch ? {
          rfbag: autoMatch.rfbag,
          availPcs: autoMatch.scannedPcs ?? autoMatch.rempcs ?? autoMatch.pcs ?? 0,
          availWt: autoMatch.scannedCwt ?? autoMatch.remwt ?? autoMatch.wt ?? 0,
          iscompany: autoMatch.iscompany,
        } : null,
        assignedBag: autoMatch?.rfbag ?? null,
        pcs: autoMatch ? String(m.pcs) : '',
        cwt: autoMatch ? String(m.wt) : '',
        txnid: null,
      };
    });
};

// ── Does a raw bag record's spec match a material row's spec? ──
const bagMatchesMaterialRow = (bag, row) => {
  if (bag.itemid !== row.itemid) return false;
  if (row.itemid === 5) {
    return norm(bag.findingtypename || '') === norm(row.findingtypename || '') &&
      norm(bag.findingAccessories || '') === norm(row.findingAccessories || '');
  }
  return norm(bag.shape || '') === norm(row.shape || '') &&
    norm(bag.quality || '') === norm(row.quality || '') &&
    norm(bag.color_name || '') === norm(row.color || '') &&
    norm(bag.size || '') === norm(row.size || '');
};

// ─────────────────────────────────────────────────────────────
const SingleBulkEntry = ({ state, actions }) => {
  const [sessionData] = useState(() => ({
    ScannedJobList: getSession('scannedJobListData'),
    ScannedMaterials: getSession('scannedJobMaterialData'),
    ScannedBags: getSession('scannedBagData'),
    AllBagListData: getSession('allBagListData'),
    AllEngagedMaterial: getSession('allEngagedMaterial'),
  }));
  const { ScannedJobList, ScannedMaterials, ScannedBags, AllBagListData, AllEngagedMaterial } = sessionData;
  const isValidScannedJob = (val) =>
    ScannedJobList.some((j) => norm(j.serialjobno) === norm(val));

  const [jobScanValue, setJobScanValue] = useState('');
  const [jobError, setJobError] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [materials, setMaterials] = useState([]);

  // ── Single global "Add Other Bag" modal ──
  const [bagModalOpen, setBagModalOpen] = useState(false);
  const [modalScanValue, setModalScanValue] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalInfo, setModalInfo] = useState(''); // success info text
  const modalInputRef = useRef(null);

  // List shown inside the modal: bags actually scanned on the Bag Scanning
  // page (scannedBagData). A bag may be assigned to several material rows, so
  // we no longer hide bags that are already assigned — the per-bag CWT stock
  // is what limits reuse, not a one-time assignment.
  const availableScannedBags = ScannedBags;

  const [savedJobs, setSavedJobs] = useState(() => {
    const entries = state.jobEntries ?? {};
    return Object.entries(entries).map(([jobId, jobData]) => ({
      jobId,
      materials: (jobData.bags || []).map((bag) => ({
        qid: bag.qid,
        jid: bag.jid,
        item: bag.item || '',
        itemid: bag.itemid || 0,
        MaterialTypeName: bag.MaterialTypeName || '',
        shape: bag.shape || '',
        quality: bag.quality || '',
        color: bag.color || '',
        size: bag.size || '',
        requiredPcs: bag.requiredPcs ?? 0,
        requiredWt: bag.requiredWt ?? 0,
        assignedBag: bag.rfbag || null,
        matchedBag: bag.rfbag ? { rfbag: bag.rfbag, availPcs: 0, availWt: 0, iscompany: bag.iscompany } : null,
        pcs: String(bag.pcs ?? ''),
        cwt: String(bag.wt ?? ''),
        isUnusedBag: bag.isUnusedBag || false,
        requiredBagNotScanned: false,
        requiredBagRfbag: null,
        txnid: bag.txnid ?? null,
      })),
    }));
  });
  const [saveFlash, setSaveFlash] = useState(false);
  const jobInputRef = useRef(null);

  useEffect(() => { jobInputRef.current?.focus(); }, []);

  // ─────────────────────────────────────────────────────────────
  // Global "Add Other Bag" modal handlers
  // ─────────────────────────────────────────────────────────────
  const openBagModal = () => {
    setBagModalOpen(true);
    setModalScanValue('');
    setModalError('');
    setModalInfo('');
    setTimeout(() => modalInputRef.current?.focus(), 80);
  };

  const closeBagModal = () => {
    setBagModalOpen(false);
    setModalScanValue('');
    setModalError('');
    setModalInfo('');
  };

  // Look up the raw bag record from session data by barcode, normalized
  const findBagRecord = (val) => {
    const fromScanned = ScannedBags.find(
      (b) => norm(b.rfbag) === norm(val) || norm(b.rfbag).endsWith(norm(val))
    );
    if (fromScanned) {
      return {
        rfbag: fromScanned.rfbag,
        itemid: fromScanned.itemid,
        shape: fromScanned.shape,
        quality: fromScanned.quality,
        color_name: fromScanned.color_name,
        size: fromScanned.size,
        findingtypename: fromScanned.findingtypename || '',
        findingAccessories: fromScanned.findingAccessories || '',
        pcs: fromScanned.scannedPcs ?? fromScanned.rempcs ?? fromScanned.pcs ?? 0,
        wt: fromScanned.scannedCwt ?? fromScanned.remwt ?? fromScanned.wt ?? 0,
        iscompany: fromScanned.iscompany,
      };
    }

    const rawBag = AllBagListData.find(
      (b) => norm(b.rfbag) === norm(val) || norm(b.rfbag).endsWith(norm(val))
    );
    if (rawBag) {
      return {
        rfbag: rawBag.rfbag,
        itemid: rawBag.itemid,
        shape: rawBag.shape,
        quality: rawBag.Quality,
        color_name: rawBag.color,
        size: rawBag.Size || rawBag.customesize || '',
        findingtypename: rawBag.findingtypename || '',
        findingAccessories: rawBag.findingAccessories || '',
        pcs: rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0),
        wt: rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0),
        iscompany: rawBag.iscompany,
      };
    }

    return null;
  };

  const handleModalBagScan = () => {
    const val = modalScanValue.trim();
    if (!val) return;
    setModalError('');
    setModalInfo('');

    const bagRecord = findBagRecord(val);
    if (!bagRecord) {
      setModalError(`Bag "${val}" not found in system.`);
      setModalScanValue('');
      return;
    }

    // ── Locker restriction: only allow bags from the currently selected locker ──
    {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bagRecord.rfbag));
      const bagLockerName = (allBagFull?.LockerName || bagRecord.LockerName || '').replace(/\s/g, '');
      const selectedLockerName = (state.locker?.name || '').replace(/\s/g, '');
      if (bagLockerName && selectedLockerName && bagLockerName !== selectedLockerName) {
        setModalError(`Bag "${bagRecord.rfbag}" belongs to locker "${allBagFull?.LockerName}" — not allowed for selected locker "${state.locker?.name}".`);
        setModalScanValue('');
        return;
      }
    }

    if (bagRecord.iscompany === 0) {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bagRecord.rfbag));
      const custCode = allBagFull?.istoreCust_Customercode || '';
      const jobCodes = new Set(ScannedJobList.map((j) => norm(j.ccode)));
      if (custCode && !jobCodes.has(norm(custCode))) {
        setModalError(`Bag "${bagRecord.rfbag}" belongs to "${allBagFull?.istoreCust_CustName || 'another customer'}" — not allowed for these jobs.`);
        setModalScanValue('');
        return;
      }
    }

    // ── Find a pending (unassigned) material row whose spec matches this bag ──
    const matchIdx = materials.findIndex((m) => !m.assignedBag && bagMatchesMaterialRow(bagRecord, m));

    if (matchIdx === -1) {
      // No matching pending material line for this bag's spec
      setModalError(`No pending material matches bag "${bagRecord.rfbag}" — check item / shape / quality / color / size.`);
      setModalScanValue('');
      return;
    }

    const row = materials[matchIdx];
    setMaterials((prev) =>
      prev.map((m, i) =>
        i === matchIdx
          ? {
            ...m,
            assignedBag: bagRecord.rfbag,
            requiredBagNotScanned: false, // resolved once a bag is actually assigned
            matchedBag: {
              rfbag: bagRecord.rfbag,
              availPcs: bagRecord.pcs ?? 0,
              availWt: bagRecord.wt ?? 0,
              iscompany: bagRecord.iscompany,
            },
            pcs: String(row.requiredPcs),
            cwt: String(row.requiredWt),
          }
          : m
      )
    );

    setModalInfo(`Bag "${bagRecord.rfbag}" assigned to row #${matchIdx + 1} (${row.MaterialTypeName || row.item}).`);
    setModalScanValue('');
    modalInputRef.current?.focus();
  };

  const handleModalKeyDown = (e) => {
    if (e.key === 'Enter') handleModalBagScan();
    else { setModalError(''); setModalInfo(''); }
  };

  // Assign a bag picked directly from the scanned-bags list inside the modal
  const handleAssignFromList = (bag) => {
    setModalError('');
    setModalInfo('');

    const bagRecord = {
      rfbag: bag.rfbag,
      itemid: bag.itemid,
      shape: bag.shape,
      quality: bag.quality,
      color_name: bag.color_name,
      size: bag.size,
      findingtypename: bag.findingtypename || '',
      findingAccessories: bag.findingAccessories || '',
      pcs: bag.scannedPcs ?? bag.rempcs ?? bag.pcs ?? 0,
      wt: bag.scannedCwt ?? bag.remwt ?? bag.wt ?? 0,
      iscompany: bag.iscompany,
    };

    // ── Locker restriction: only allow bags from the currently selected locker ──
    {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bagRecord.rfbag));
      const bagLockerName = (allBagFull?.LockerName || bagRecord.LockerName || '').replace(/\s/g, '');
      const selectedLockerName = (state.locker?.name || '').replace(/\s/g, '');
      if (bagLockerName && selectedLockerName && bagLockerName !== selectedLockerName) {
        setModalError(`Bag "${bagRecord.rfbag}" belongs to locker "${allBagFull?.LockerName}" — not allowed for selected locker "${state.locker?.name}".`);
        return;
      }
    }

    if (bagRecord.iscompany === 0) {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(bagRecord.rfbag));
      const custCode = allBagFull?.istoreCust_Customercode || '';
      const jobCodes = new Set(ScannedJobList.map((j) => norm(j.ccode)));
      if (custCode && !jobCodes.has(norm(custCode))) {
        setModalError(`Bag "${bagRecord.rfbag}" belongs to "${allBagFull?.istoreCust_CustName || 'another customer'}" — not allowed for these jobs.`);
        return;
      }
    }

    const matchIdx = materials.findIndex((m) => !m.assignedBag && bagMatchesMaterialRow(bagRecord, m));
    if (matchIdx === -1) {
      setModalError(`No pending material matches bag "${bagRecord.rfbag}" — check item / shape / quality / color / size.`);
      return;
    }

    const row = materials[matchIdx];
    setMaterials((prev) =>
      prev.map((m, i) =>
        i === matchIdx
          ? {
            ...m,
            assignedBag: bagRecord.rfbag,
            requiredBagNotScanned: false,
            matchedBag: {
              rfbag: bagRecord.rfbag,
              availPcs: bagRecord.pcs ?? 0,
              availWt: bagRecord.wt ?? 0,
              iscompany: bagRecord.iscompany,
            },
            pcs: String(row.requiredPcs),
            cwt: String(row.requiredWt),
          }
          : m
      )
    );

    setModalInfo(`Bag "${bagRecord.rfbag}" assigned to row #${matchIdx + 1} (${row.MaterialTypeName || row.item}).`);
  };

  // ─────────────────────────────────────────────────────────────
  // Job scan
  // ─────────────────────────────────────────────────────────────
  const handleJobScan = () => {
    const val = jobScanValue.trim();
    if (!val) return;

    const existingSave = savedJobs.find((s) => norm(s.jobId) === norm(val));
    if (existingSave) {
      setJobError('');
      setActiveJob({ id: val, locked: true });
      setMaterials(existingSave.materials);
      setJobScanValue('');
      return;
    }

    if (!isValidScannedJob(val)) {
      setJobError(`"${val}" was not scanned on the Scan Jobs page.`);
      setJobScanValue('');
      return;
    }

    const hasLines = ScannedMaterials.some((m) => norm(m.SerialJobNo) === norm(val));
    if (!hasLines) {
      setJobError(`Job "${val}" has no material data in the system.`);
      setJobScanValue('');
      return;
    }

    setJobError('');
    setActiveJob({ id: val });
    const freshRows = buildMaterialRows(
      val, state.materialType,
      ScannedMaterials, ScannedBags,
      state.requiredBags, state.scannedBags
    );

    // A material row only counts as "engaged with a usable bag" when it
    // actually has a matched/assigned bag. Rows whose required bag was
    // never scanned (matchedBag === null) stay as plain pending rows —
    // engagedLocked never gets set true for them, even if allEngagedMaterial
    // has a matching record, since there's no physical bag behind it yet.
    const regularRows = freshRows.map(row => {
      if (!row.matchedBag) return row; // no bag → cannot be engaged-locked
      const engaged = getEngagedTotals(AllEngagedMaterial, val, row);
      if (engaged) {
        return {
          ...row,
          pcs: String(engaged.pcs),
          cwt: engaged.wt.toFixed(3),
          engagedLocked: true,
          txnid: engaged.txnid ?? row.txnid ?? null,
        };
      }
      return row;
    });

    // Extra engaged rows: allEngagedMaterial grouped by rfbag+material, excluding bags already on regular rows
    const allowedItemIds = MATERIAL_ITEMID_MAP[state.materialType] ?? null;
    const egMap = {};
    (AllEngagedMaterial || []).forEach(e => {
      if (!e.isengage) return;
      if (norm(e.serialjobno) !== norm(val)) return;
      if (allowedItemIds && !allowedItemIds.includes(e.itemid)) return;
      const key = [norm(e.rfbag), e.itemid, norm(e.shape || ''), norm(e.Quality || ''), norm(e.color || ''), norm(e.Size || ''), norm(e.findingtypename || ''), norm(e.findingAccessories || '')].join('|');
      if (!egMap[key]) egMap[key] = { ...e, totalPcs: 0, totalWt: 0, txnids: new Set() };
      egMap[key].totalPcs += Number(e.isspcs || 0);
      egMap[key].totalWt += Number(e.isswt || 0);
      if (e.txnid !== undefined && e.txnid !== null && e.txnid !== '') {
        egMap[key].txnids.add(e.txnid);
      }
    });
    const extraMats = Object.values(egMap)
      .filter(e => !regularRows.some(line => {
        if (!line.matchedBag || norm(line.matchedBag.rfbag) !== norm(e.rfbag)) return false;
        if (e.itemid !== line.itemid) return false;
        if (line.itemid === 5) {
          return norm(e.findingtypename || '') === norm(line.findingtypename || '') &&
            norm(e.findingAccessories || '') === norm(line.findingAccessories || '');
        }
        return norm(e.shape || '') === norm(line.shape || '') &&
          norm(e.Quality || '') === norm(line.quality || '') &&
          norm(e.color || '') === norm(line.color || '') &&
          norm(e.Size || '') === norm(line.size || '');
      }))
      .map((e) => {
        const rawBag = AllBagListData.find(b => norm(b.rfbag) === norm(e.rfbag)) ||
          ScannedBags.find(b => norm(b.rfbag) === norm(e.rfbag));
        const availPcs = rawBag ? (rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0)) : 0;
        const availWt = rawBag ? (rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0)) : 0;
        const iscompany = rawBag ? rawBag.iscompany : undefined;
        const itemName = e.itemid === 3 ? 'DIAMOND' : e.itemid === 4 ? 'COLORSTONE' : e.itemid === 5 ? 'FINDING' : 'MISC';
        const txnidList = [...e.txnids];
        // An "extra engaged" row always has a real rfbag from allEngagedMaterial,
        // so it always has a bag — engagedLocked is safe here.
        return {
          qid: e.qid ?? null, jid: e.jid ?? null,
          SerialJobNo: val, QuotationNo: e.QuotationNo || '',
          item: itemName, itemid: e.itemid, MaterialTypeName: null,
          shape: e.shape || '', quality: e.Quality || '', color: e.color || '', size: e.Size || '',
          findingtypename: e.findingtypename || '', findingAccessories: e.findingAccessories || '',
          requiredPcs: e.totalPcs, requiredWt: e.totalWt,
          isUnusedBag: false, isExtraEngaged: true,
          requiredBagNotScanned: false, requiredBagRfbag: null,
          matchedBag: { rfbag: e.rfbag, availPcs, availWt, iscompany },
          assignedBag: e.rfbag,
          pcs: String(e.totalPcs), cwt: e.totalWt.toFixed(3),
          engagedLocked: true,
          txnid: txnidList.length ? txnidList.join(',') : null,
        };
      });

    setMaterials([...regularRows, ...extraMats]);
    setJobScanValue('');
  };

  const handleJobKeyDown = (e) => { if (e.key === 'Enter') handleJobScan(); else setJobError(''); };

  // ─────────────────────────────────────────────────────────────
  // Row helpers
  // ─────────────────────────────────────────────────────────────
  const handleRemoveBag = (idx) => {
    setMaterials((prev) =>
      prev.map((m, i) => i === idx ? { ...m, assignedBag: null, matchedBag: null, pcs: '', cwt: '' } : m)
    );
  };

  const handleReturnMaterial = (idx) => {
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, engagedLocked: false, engagedBypass: true } : m));
  };

  const handleFieldChange = (idx, field, value) => {
    if (activeJob?.locked) return;
    setMaterials((prev) => prev.map((m, i) => {
      if (i !== idx) return m;
      if (m.engagedLocked) return m;
      const updated = { ...m, [field]: value };
      // Only CWT (weight) is capped, and the cap is the bag's TOTAL available
      // weight minus whatever is already committed to that same bag on other
      // rows of this job and on every other saved job. PCS is not capped.
      if (field === 'cwt' && m.matchedBag) {
        const avail = m.matchedBag.availWt ?? 0;
        const rfbag = m.assignedBag;
        const savedUsed = sumSavedBagCwt(state.jobEntries, rfbag, activeJob?.id);
        let otherRowsUsed = 0;
        prev.forEach((mm, j) => {
          if (j !== idx && rfbag && norm(mm.assignedBag) === norm(rfbag)) {
            otherRowsUsed += parseFloat(mm.cwt) || 0;
          }
        });
        const remaining = avail - savedUsed - otherRowsUsed;
        updated.cwtError = avail > 0 && (parseFloat(value) || 0) > remaining + 1e-6;
      }
      return updated;
    }));
  };

  const handleUnlock = () => {
    if (!activeJob) return;
    setSavedJobs((prev) => prev.filter((s) => norm(s.jobId) !== norm(activeJob.id)));
    setActiveJob({ id: activeJob.id });
  };

  const handleSaveJob = () => {
    if (!activeJob) return;
    if (materials.some((m) => m.pcsError || m.cwtError)) return;
    if (materials.some((m) => m.assignedBag && !m.engagedLocked && !(parseFloat(m.cwt) > 0))) return;
    const entries = materials.map((m) => ({
      qid: m.qid,
      jid: m.jid,
      isUnusedBag: m.isUnusedBag,
      item: m.item,
      itemid: m.itemid,
      MaterialTypeName: m.MaterialTypeName,
      shape: m.shape,
      quality: m.quality,
      color: m.color,
      size: m.size,
      findingtypename: m.findingtypename || '',
      findingAccessories: m.findingAccessories || '',
      requiredPcs: m.requiredPcs,
      requiredWt: m.requiredWt,
      assignedBag: m.assignedBag,
      rfbag: m.assignedBag || null,
      bag: m.assignedBag ? { rfbag: m.assignedBag } : null,
      iscompany: m.matchedBag?.iscompany ?? null,
      txnid: m.txnid ?? null,
      pcs: parseFloat(m.pcs) || 0,
      wt: parseFloat(m.cwt) || 0,
    }));
    if (actions?.updateJobEntry) actions.updateJobEntry(activeJob.id, { bags: entries });
    setSavedJobs((prev) => [...prev, { jobId: activeJob.id, materials: [...materials] }]);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 700);
    setActiveJob(null);
    setMaterials([]);
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

  // ── Sort: group by item type, engaged rows first within each group ──
  const itemOrder = { 3: 1, 4: 2, 5: 3, 7: 4 }; // Diamond, Colorstone, Finding, Misc

  const sortedMaterials = useMemo(() => {
    return materials
      .map((m, idx) => ({ ...m, __idx: idx })) // keep original index for stable fallback
      .sort((a, b) => {
        // 1. Group by item type
        const typeCompare = (itemOrder[a.itemid] || 999) - (itemOrder[b.itemid] || 999);
        if (typeCompare !== 0) return typeCompare;

        // 2. Engaged rows first within the same type. Use engagedBypass too so a
        // row that was returned (engagedLocked flipped to false) keeps its slot
        // instead of jumping position when the Return button is clicked.
        const aEngaged = (a.engagedLocked || a.engagedBypass) ? 0 : 1;
        const bEngaged = (b.engagedLocked || b.engagedBypass) ? 0 : 1;
        if (aEngaged !== bEngaged) return aEngaged - bEngaged;

        // 3. Keep original relative order otherwise
        return a.__idx - b.__idx;
      });
  }, [materials]);

  // Remaining CWT that a row may still pull from its bag: the bag's total
  // available weight minus what other rows of this job and every saved job
  // have already committed to the same bag.
  const getRowRemainingCwt = (mat) => {
    const avail = mat.matchedBag?.availWt ?? 0;
    if (!mat.assignedBag) return avail;
    const savedUsed = sumSavedBagCwt(state.jobEntries, mat.assignedBag, activeJob?.id);
    let otherUsed = 0;
    materials.forEach((mm, i) => {
      if (i === mat.__idx) return;
      if (norm(mm.assignedBag) === norm(mat.assignedBag)) otherUsed += parseFloat(mm.cwt) || 0;
    });
    return avail - savedUsed - otherUsed;
  };

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
                <span>Job: <strong>{activeJob.id}</strong></span>
              </div>
              <div className="sbe-card__badges">
                {!activeJob?.locked && pendingCount > 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={openBagModal}
                    startIcon={<Plus size={14} />}
                    className="sbe-btn-assign"
                  >
                    Add Other Bag
                  </Button>
                )}
                <span className="sbe-badge sbe-badge--blue">{matLabel}</span>
                <span className="sbe-badge sbe-badge--green"><CheckCircle2 size={12} /> {assignedCount} assigned</span>
                {pendingCount > 0 && <span className="sbe-badge sbe-badge--amber"><AlertTriangle size={12} /> {pendingCount} pending</span>}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="sbe-table">
              <div className="sbe-table__head">
                <span className="sbe-col sbe-col--no">#</span>
                <span className="sbe-col sbe-col--item">Item</span>
                <span className="sbe-col sbe-col--spec">Spec</span>
                <span className="sbe-col sbe-col--bag">Bag No.</span>
                <span className="sbe-col sbe-col--req">Req. PCS</span>
                <span className="sbe-col sbe-col--req">Req. CTW / Gms</span>
                <span className="sbe-col sbe-col--issue">Issue PCS</span>
                <span className="sbe-col sbe-col--issue">Issue CWT</span>
              </div>

              <div className="sbe-table__body">
                {materials.length === 0 ? (
                  <div className="sbe-table__empty">
                    No {matLabel} rows found for this job.
                  </div>
                ) : (
                  sortedMaterials.map((mat, idx) => {
                    const has = !!mat.assignedBag;

                    // Engaged-locked view only applies when there's an actual
                    // assigned bag behind the engagement — otherwise a row can
                    // show "Already Engaged" with a Return button even though
                    // no physical bag was ever scanned for it.
                    const isEngagedLocked = !activeJob?.locked && mat.engagedLocked && has;

                    // Row is blocked because its required bag was never scanned
                    // in the Bag Scanning step, and no bag has been manually
                    // assigned via "Add Other Bag" either.
                    const noBagBlocked = !has && mat.requiredBagNotScanned;

                    const isExhausted = !isEngagedLocked && !mat.engagedBypass && has && mat.matchedBag &&
                      (mat.matchedBag.availPcs ?? 0) <= 0 &&
                      (mat.matchedBag.availWt ?? 0) <= 0;

                    return (
                      <div
                        key={`row-${mat.__idx}`}
                        className={[
                          'sbe-table__row',
                          has ? 'sbe-table__row--ok' : 'sbe-table__row--pend',
                          noBagBlocked ? 'sbe-table__row--not-scanned' : '',
                        ].filter(Boolean).join(' ')}
                      // Rows are display-only now — bag assignment happens
                      // only via the global "Add Other Bag" modal, which
                      // auto-matches by item / shape / quality / color / size.
                      >
                        <span className="sbe-col sbe-col--no sbe-idx">{idx + 1}</span>

                        <span className="sbe-col sbe-col--item sbe-item-cell"
                          style={{ '--ic': getMaterialColor(mat.itemid) }}>
                          <span>{mat.MaterialTypeName || mat.item}</span>
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
                            <span
                              className={`sbe-bag-ok--${mat.matchedBag
                                ? mat.matchedBag.iscompany == 1
                                  ? 'autocomp'
                                  : 'autoccust'
                                : 'manual'
                                }`}
                            >
                              <CheckCircle2 size={12} />
                              <span className="sbe-bag-ok__no">{mat.assignedBag}</span>
                              {mat.matchedBag && (
                                <span
                                >
                                  {mat.matchedBag.iscompany == 1 ? 'Company' : 'Customer'}
                                </span>
                              )}
                            </span>
                          ) : mat.requiredBagNotScanned ? (
                            <span className="sbe-bag-none sbe-bag-none--warn">
                              <AlertCircle size={11} /> Not scanned: {mat.requiredBagRfbag}
                            </span>
                          ) : (
                            <span className="sbe-bag-none">-</span>
                          )}
                        </span>
                        <span className="sbe-col sbe-col--req sbe-req">{mat.requiredPcs}</span>
                        <span className="sbe-col sbe-col--req sbe-req">{mat.requiredWt}</span>

                        <span className="sbe-col sbe-col--issue" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                          {activeJob?.locked
                            ? <span className="sbe-locked-val">{mat.pcs || '—'}</span>
                            : noBagBlocked
                              ? <span className="sbe-exhausted-cell">Bag not scanned</span>
                              : isEngagedLocked
                                ? <div className="sbe-engaged-lock">
                                  <span className="sbe-engaged-val">{mat.pcs ?? '—'}</span>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="sbe-return-btn" onClick={(e) => { e.stopPropagation(); handleReturnMaterial(mat.__idx); }}
                                      style={{ position: 'absolute', top: '20%', right: '-20px' }}
                                    >
                                      <RotateCcw size={9} /> Return
                                    </button>
                                  </div>
                                </div>
                                : isExhausted
                                  ? <span className="sbe-exhausted-cell">Scan other bag</span>
                                  : <input type="number"
                                    className={`sbe-num ${!has ? 'sbe-num--off' : mat.pcsError ? 'sbe-num--error' : ''}`}
                                    value={mat.pcs}
                                    onChange={(e) => handleFieldChange(mat.__idx, 'pcs', e.target.value)}
                                    placeholder="PCS" disabled={!has} />
                          }
                          <p style={{ display: 'flex', padding: '0 7px', width: '100%' }}>
                            {has && mat.matchedBag && !isExhausted && !isEngagedLocked
                              ? <span style={{ color: mat.pcsError ? '#ef4444' : undefined }}>
                                {mat.pcsError ? `Max ${mat.matchedBag.availPcs}` : `Avl: ${mat.matchedBag.availPcs}`}
                              </span>
                              : <span className="sbe-dash"></span>}
                          </p>
                        </span>
                        <span className="sbe-col sbe-col--issue" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
                          {activeJob?.locked
                            ? <span className="sbe-locked-val">{mat.cwt || '—'}</span>
                            : noBagBlocked
                              ? <span className="sbe-exhausted-cell">Bag not scanned</span>
                              : isEngagedLocked
                                ? <span className="sbe-engaged-val">{mat.cwt ?? '—'}</span>
                                : isExhausted
                                  ? <span className="sbe-exhausted-cell">0 stock</span>
                                  : <input type="number" step="0.001"
                                    className={`sbe-num ${!has ? 'sbe-num--off' : mat.cwtError ? 'sbe-num--error' : ''}`}
                                    value={mat.cwt}
                                    onChange={(e) => handleFieldChange(mat.__idx, 'cwt', e.target.value)}
                                    placeholder="CWT" disabled={!has} />
                          }
                          <p style={{ display: 'flex', padding: '0 7px', width: '100%' }}>
                            {has && mat.matchedBag && !isExhausted && !isEngagedLocked
                              ? (() => {
                                const remCwt = getRowRemainingCwt(mat);
                                return (
                                  <span style={{ color: mat.cwtError ? '#ef4444' : undefined }}>
                                    {mat.cwtError ? `Max ${remCwt.toFixed(3)}` : `Avl: ${remCwt.toFixed(3)}`}
                                  </span>
                                );
                              })()
                              : <span className="sbe-dash"></span>}
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

      {/* ── Add Other Bag modal (material-spec auto-match) ── */}
      {bagModalOpen && (
        <div className="sbe-modal-overlay" onClick={closeBagModal}>
          <div className="sbe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sbe-modal__head">
              <span>Add Other Bag</span>
              <button className="sbe-modal__close" onClick={closeBagModal}>
                <X size={16} />
              </button>
            </div>
            <div className="sbe-modal__body">
              <p style={{ fontSize: 12, color: 'var(--text-muted, #757575)', margin: '0 0 10px' }}>
                Scan a bag barcode, or pick one below. It will automatically be
                assigned to the pending material row whose item / shape / quality / color / size matches.
              </p>
              <input
                ref={modalInputRef}
                type="text"
                className={`sbe-input ${modalError ? 'sbe-input--error' : ''}`}
                value={modalScanValue}
                onChange={(e) => { setModalScanValue(e.target.value); setModalError(''); setModalInfo(''); }}
                onKeyDown={handleModalKeyDown}
                placeholder="Scan bag barcode..."
              />
              {modalError && <div className="sbe-error"><AlertTriangle size={12} /> {modalError}</div>}
              {modalInfo && (
                <div className="sbe-error" style={{ color: 'var(--success, #2e7d32)' }}>
                  <CheckCircle2 size={12} /> {modalInfo}
                </div>
              )}

              {/* ── Scanned bags list (from scannedBagData) ── */}
              <div className="sbe-modal__bag-list-head">
                <span>Scanned Bags</span>
                <span className="sbe-row-count">{availableScannedBags.length}</span>
              </div>
              <div className="sbe-modal__bag-list">
                {availableScannedBags.length === 0 ? (
                  <div className="sbe-modal__bag-empty">
                    No unassigned scanned bags available.
                  </div>
                ) : (
                  availableScannedBags.map((b, i) => (
                    <button
                      key={`${b.rfbag}_${i}`}
                      type="button"
                      className="sbe-modal__bag-item"
                      onClick={() => handleAssignFromList(b)}
                      style={{ '--ic': getMaterialColor(b.itemid) }}
                    >
                      <span className="sbe-modal__bag-no">{b.rfbag}</span>
                      <span className="sbe-modal__bag-spec">
                        {b.shape} · {b.quality} · {b.color_name} · {b.size}
                        {b.itemid === 5 && (b.findingtypename || b.findingAccessories)
                          ? ` · ${b.findingtypename} ${b.findingAccessories}`.trim()
                          : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="sbe-modal__footer">
              <Button variant="outlined" onClick={closeBagModal}>Close</Button>
              <Button variant="contained" onClick={handleModalBagScan} disabled={!modalScanValue.trim()}>
                Assign Bag
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Saved jobs ── */}
      {savedJobs.length > 0 && (
        <div className="sbe-saved">
          <div className="sbe-saved__title"><CheckCircle2 size={14} />Job</div>
          {savedJobs.map((sj, i) => {
            const a = sj.materials.filter((m) => m.assignedBag).length;
            const n = sj.materials.length - a;
            const totReqWt = sj.materials.reduce((acc, m) => acc + (m.requiredWt || 0), 0);
            const totEntryWt = sj.materials.reduce((acc, m) => acc + (parseFloat(m.cwt) || 0), 0);
            const totReqPcs = sj.materials.reduce((acc, m) => acc + (m.requiredPcs || 0), 0);
            const totEntryPcs = sj.materials.reduce((acc, m) => acc + (parseFloat(m.pcs) || 0), 0);

            return (
              <div key={i} className="sbe-saved__job">
                <div className="sbe-saved__job-head">
                  <strong>{sj.jobId}</strong>
                  <span className="sbe-saved__meta">
                    {sj.materials.length} rows · {a} bags
                    {n > 0 && <span className="sbe-saved__no-bag-pill">{n} no bag</span>}
                  </span>
                </div>

                {/* Summary totals */}
                <div style={{ display: 'flex', gap: 8, padding: '4px 0 6px', flexWrap: 'wrap' }}>
                  <span className="sbe-saved__sum-chip">
                    PCS: <b>{totEntryPcs}</b>/<span style={{ color: '#888' }}>{totReqPcs}</span>
                  </span>
                  <span className="sbe-saved__sum-chip">
                    CTW: <b>{totEntryWt.toFixed(3)}</b>/<span style={{ color: '#888' }}>{totReqWt.toFixed(3)}</span>
                  </span>
                </div>

                <div className="sbe-saved__chips">
                  {sj.materials.map((m, mi) => (
                    <div key={`${m.qid}_${m.jid}_${mi}`} className={`sbe-saved__chip ${!m.assignedBag ? 'sbe-saved__chip--warn' : ''}`}>
                      <span className="sbe-saved__spec">{m.shape} · {m.quality} · {m.color}{m.size ? ` · ${m.size}` : ''}</span>
                      {m.assignedBag
                        ? <span className="sbe-saved__bag">{m.assignedBag}</span>
                        : <span className="sbe-saved__nobag">No bag</span>
                      }
                      <span className="sbe-saved__vals">{m.pcs || '—'} pcs / {m.cwt || '—'} ctw</span>
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