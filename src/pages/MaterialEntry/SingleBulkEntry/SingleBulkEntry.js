import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ScanLine, CheckCircle2, AlertTriangle,
  PackageOpen, Package, Gem, Palette, Wrench, X, RotateCcw, AlertCircle,
  Plus
} from 'lucide-react';
import Button from '@mui/material/Button';
import { useGlobalScanner } from '../../../hooks/useGlobalScanner';

import { getMaster, isMasterKey } from '../../../Utils/masterStore';
import { sumSavedBagCwt, getJobInfo, getRemainingBagStock, getSavedBagUsage } from '../../../Utils/globalFunc';
import { materialTypeItemIds, toMaterialTypeList, materialTypeLabel } from '../../../Utils/materialTypes';
import defaultJobImg from '../../../images/default.jpg';
import ScannerInput from '../../../components/ScannerInput/ScannerInput';
import './SingleBulkEntry.scss'
// ─────────────────────────────────────────────────────────────
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

// Build material rows from scannedJobMaterialData
const buildMaterialRows = (
  serialJobNo, materialType = 'all',
  ScannedMaterials, ScannedBags,
  requiredBags = [], scannedBagsCtx = []
) => {
  const allowedItemIds = materialTypeItemIds(materialType);
  return ScannedMaterials
    .filter((m) => norm(m.SerialJobNo) === norm(serialJobNo))
    .filter((m) => !allowedItemIds || allowedItemIds.includes(m.itemid))
    .map((m) => {
      const lineRequiredBags = requiredBags.filter(
        (rb) => rb.qid === m.qid && rb.jid === m.jid
      );
      const anyScanned = lineRequiredBags.some((rb) =>
        ScannedBags.some((b) =>
          norm(b.rfbag) === norm(rb.rfbag) &&
          (!b.SerialJobNo || norm(b.SerialJobNo) === norm(m.SerialJobNo))
        )
      );
      const hasRequired = lineRequiredBags.length > 0;

      const autoMatch =
        ScannedBags.find((b) =>
          b.qid === m.qid && b.jid === m.jid &&
          (!b.SerialJobNo || norm(b.SerialJobNo) === norm(m.SerialJobNo))
        ) ||
        ScannedBags.find((b) =>
          (!b.SerialJobNo || norm(b.SerialJobNo) === norm(m.SerialJobNo)) &&
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

// ── Totals for one saved job's material rows (used by the summary panel) ──
const jobTotals = (rows = []) => {
  const engaged = rows.filter((m) => m.assignedBag).length;
  return {
    rows: rows.length,
    engaged,
    noEngage: rows.length - engaged,
    reqPcs: rows.reduce((a, m) => a + (m.requiredPcs || 0), 0),
    reqWt: rows.reduce((a, m) => a + (m.requiredWt || 0), 0),
    entryPcs: rows.reduce((a, m) => a + (parseFloat(m.pcs) || 0), 0),
    entryWt: rows.reduce((a, m) => a + (parseFloat(m.cwt) || 0), 0),
  };
};

// ── Does an engaged record (allEngagedMaterial) match a material row's spec? ──
const engagedMatchesRowSpec = (e, row) => {
  if (e.itemid !== row.itemid) return false;
  if (row.itemid === 5) {
    return norm(e.findingtypename || '') === norm(row.findingtypename || '') &&
      norm(e.findingAccessories || '') === norm(row.findingAccessories || '');
  }
  return norm(e.shape || '') === norm(row.shape || '') &&
    norm(e.Quality || '') === norm(row.quality || '') &&
    norm(e.color || '') === norm(row.color || '') &&
    norm(e.Size || '') === norm(row.size || '');
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

  // Auto-save: whenever materials change (PCS/CWT input, bag assignment, return),
  // persist to context immediately — no manual "Save" button needed.
  useEffect(() => {
    if (!activeJob) return;
    if (materials.length === 0) return;
    autoSaveActiveJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

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

  const validateOtherBagStock = (bagRecord) => {
    if (materials.some((m) => norm(m.assignedBag) === norm(bagRecord.rfbag))) {
      return `Bag "${bagRecord.rfbag}" is already added to this job.`;
    }
    const remaining = getRemainingBagStock(
      state.jobEntries,
      bagRecord.rfbag,
      bagRecord.pcs,
      bagRecord.wt,
      activeJob?.id
    );
    if (remaining.pcs <= 0 || remaining.cwt <= 0) {
      return `Bag "${bagRecord.rfbag}" is fully used. No PCS / CWT remains.`;
    }
    bagRecord.pcs = remaining.pcs;
    bagRecord.wt = remaining.cwt;
    return '';
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

    const stockError = validateOtherBagStock(bagRecord);
    if (stockError) {
      setModalError(stockError);
      setModalScanValue('');
      return;
    }

    // ── Find a pending (unassigned) material row whose spec matches this bag ──
    const matchIdx = materials.findIndex((m) => !m.assignedBag && bagMatchesMaterialRow(bagRecord, m));

    if (matchIdx === -1) {
      // No matching pending material line for this bag's spec. If the job has
      // no material rows at all (no quotation data), create a brand-new row
      // from the bag so the user can still engage other material.
      if (materials.length === 0) {
        const baseName = bagRecord.itemid === 3 ? 'DIAMOND'
          : bagRecord.itemid === 4 ? 'COLORSTONE'
            : bagRecord.itemid === 5 ? 'FINDING' : 'MISC';
        const item = withCenterSuffix(baseName, bagRecord);
        const jobInfo = ScannedJobList.find((j) => norm(j.serialjobno) === norm(activeJob?.id));
        const newRow = {
          qid: null,
          jid: jobInfo?.jid ?? null,
          SerialJobNo: activeJob?.id ?? '',
          QuotationNo: '',
          item, itemid: bagRecord.itemid,
          MaterialTypeName: null,
          IsCenterStone: bagRecord.IsCenterStone ?? 0,
          stone_uniqueno: bagRecord.stone_uniqueno || '',
          shape: bagRecord.shape || '',
          quality: bagRecord.quality || '',
          color: bagRecord.color_name || bagRecord.color || '',
          size: bagRecord.size || '',
          findingtypename: bagRecord.findingtypename || '',
          findingAccessories: bagRecord.findingAccessories || '',
          requiredPcs: 0, requiredWt: 0,
          matchedBag: {
            rfbag: bagRecord.rfbag,
            availPcs: bagRecord.pcs ?? 0,
            availWt: bagRecord.wt ?? 0,
            iscompany: bagRecord.iscompany,
          },
          assignedBag: bagRecord.rfbag,
          requiredBagNotScanned: false,
          isUnusedBag: true,
          isExtraEngaged: false,
          pcs: '',
          cwt: '',
          pcsError: false,
          cwtError: false,
        };
        setMaterials([newRow]);
        setModalInfo(`Bag "${bagRecord.rfbag}" added as a new material line for this job.`);
        setModalScanValue('');
        modalInputRef.current?.focus();
        return;
      }
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

    const stockError = validateOtherBagStock(bagRecord);
    if (stockError) {
      setModalError(stockError);
      return;
    }

    const matchIdx = materials.findIndex((m) => !m.assignedBag && bagMatchesMaterialRow(bagRecord, m));
    if (matchIdx === -1) {
      // No matching pending row — if the job has no material rows at all,
      // create a brand-new row from the bag so the user can still engage.
      if (materials.length === 0) {
        const baseName = bagRecord.itemid === 3 ? 'DIAMOND'
          : bagRecord.itemid === 4 ? 'COLORSTONE'
            : bagRecord.itemid === 5 ? 'FINDING' : 'MISC';
        const item = withCenterSuffix(baseName, bagRecord);
        const jobInfo = ScannedJobList.find((j) => norm(j.serialjobno) === norm(activeJob?.id));
        const newRow = {
          qid: null,
          jid: jobInfo?.jid ?? null,
          SerialJobNo: activeJob?.id ?? '',
          QuotationNo: '',
          item, itemid: bagRecord.itemid,
          MaterialTypeName: null,
          IsCenterStone: bagRecord.IsCenterStone ?? 0,
          stone_uniqueno: bagRecord.stone_uniqueno || '',
          shape: bagRecord.shape || '',
          quality: bagRecord.quality || '',
          color: bagRecord.color_name || bagRecord.color || '',
          size: bagRecord.size || '',
          findingtypename: bagRecord.findingtypename || '',
          findingAccessories: bagRecord.findingAccessories || '',
          requiredPcs: 0, requiredWt: 0,
          matchedBag: {
            rfbag: bagRecord.rfbag,
            availPcs: bagRecord.pcs ?? 0,
            availWt: bagRecord.wt ?? 0,
            iscompany: bagRecord.iscompany,
          },
          assignedBag: bagRecord.rfbag,
          requiredBagNotScanned: false,
          isUnusedBag: true,
          isExtraEngaged: false,
          pcs: '',
          cwt: '',
          pcsError: false,
          cwtError: false,
        };
        setMaterials([newRow]);
        setModalInfo(`Bag "${bagRecord.rfbag}" added as a new material line for this job.`);
        return;
      }
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
  const handleJobScan = (rawVal) => {
    const val = (rawVal ?? jobScanValue).trim();
    if (!val) return;
    setJobScanValue(val);

    // Auto-save the currently active job before switching to a new one.
    // This replaces the manual "Save Job & Add Next" button — any changes
    // the user made are persisted to context automatically.
    if (activeJob && norm(activeJob.id) !== norm(val)) {
      autoSaveActiveJob();
    }

    const existingSave = savedJobs.find((s) => norm(s.jobId) === norm(val));
    if (existingSave) {
      setJobError('');
      const jobInfo = getJobInfo(val, ScannedJobList);
      setActiveJob({
        id: val, locked: true, imagepath: jobInfo?.imagepath ?? null, Designno: jobInfo?.design,
        Serialfor: jobInfo?.category, customerCode: jobInfo?.ccode,
        CurrentStatus: jobInfo?.status,
        metal: jobInfo?.metal, metalColor: jobInfo?.color
      });
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
    setJobError('');
    const jobInfo = getJobInfo(val, ScannedJobList);
    setActiveJob({
      id: val, locked: false, imagepath: jobInfo?.imagepath ?? null, Designno: jobInfo?.design,
      Serialfor: jobInfo?.category, customerCode: jobInfo?.ccode,
      CurrentStatus: jobInfo?.status,
      metal: jobInfo?.metal, metalColor: jobInfo?.color
    });
    if (!hasLines) {
      // Job has no quotation material lines — start with an empty material
      // list. The user can still add "Other Bag" rows via the modal, which now
      // supports creating brand-new rows when no pending row matches.
      setMaterials([]);
      setJobScanValue('');
      setTimeout(() => jobInputRef.current?.focus(), 80);
      return;
    }
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
    const allowedItemIds = materialTypeItemIds(state.materialType);
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
    // Merge engaged records into the job's material rows. An engaged record is
    // NOT shown as its own row when the job already has a required material
    // line with the same spec — the engaged bag/qty is applied onto that line
    // so the user sees ONE row per material instead of an engaged row plus a
    // "Bag not scanned" row. Only engaged material with no matching required
    // line at all becomes an extra row.
    const rows = [...regularRows];
    const extraMats = [];

    Object.values(egMap).forEach((e) => {
      const rawBag = AllBagListData.find(b => norm(b.rfbag) === norm(e.rfbag)) ||
        ScannedBags.find(b => norm(b.rfbag) === norm(e.rfbag));
      const availPcs = rawBag ? (rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0)) : 0;
      const availWt = rawBag ? (rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0)) : 0;
      const iscompany = rawBag ? rawBag.iscompany : undefined;
      const txnidList = [...e.txnids];
      const txnid = txnidList.length ? txnidList.join(',') : null;

      // Already reflected on a row that holds this very bag → nothing to do.
      const alreadyOnBag = rows.some((line) =>
        line.matchedBag && norm(line.matchedBag.rfbag) === norm(e.rfbag) &&
        engagedMatchesRowSpec(e, line)
      );
      if (alreadyOnBag) return;

      // Attach to an existing required line of the same spec that has no bag yet.
      const targetIdx = rows.findIndex((line) =>
        !line.matchedBag && !line.assignedBag && engagedMatchesRowSpec(e, line)
      );
      if (targetIdx !== -1) {
        const line = rows[targetIdx];
        rows[targetIdx] = {
          ...line,
          matchedBag: { rfbag: e.rfbag, availPcs, availWt, iscompany },
          assignedBag: e.rfbag,
          // the required bag question is settled once engaged material is attached
          requiredBagNotScanned: false,
          requiredBagRfbag: null,
          pcs: String(e.totalPcs),
          cwt: e.totalWt.toFixed(3),
          engagedLocked: true,
          txnid: txnid ?? line.txnid ?? null,
        };
        return;
      }

      // No required line for this engaged material → keep it as an extra row.
      const itemName = e.itemid === 3 ? 'DIAMOND' : e.itemid === 4 ? 'COLORSTONE' : e.itemid === 5 ? 'FINDING' : 'MISC';
      extraMats.push({
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
        txnid,
      });
    });

    const jobInfo2 = ScannedJobList.find((j) => norm(j.serialjobno) === norm(val));
    const jobCcode = norm(jobInfo2?.ccode || '');

    const alreadyAssignedRfbags = new Set(
      [...rows, ...extraMats]
        .map((l) => l.assignedBag)
        .filter(Boolean)
        .map(norm)
    );

    const otherBagRows = (state.otherBags || [])
      .filter((bag) => {
        if (!bag.rfbag) return false;
        if (alreadyAssignedRfbags.has(norm(bag.rfbag))) return false; // already on a row
        // company bags allowed for all jobs; customer bags only for matching ccode
        if (bag.iscompany === 1 || bag.iscompany === undefined) return true;
        return jobCcode !== '' && norm(bag.istoreCust_Customercode || '') === jobCcode;
      })
      .map((bag) => ({
        bag,
        remaining: getRemainingBagStock(
          state.jobEntries,
          bag.rfbag,
          bag.rempcs ?? bag.pcs ?? 0,
          bag.remwt ?? bag.wt ?? 0,
          val
        ),
      }))
      .filter(({ remaining }) => remaining.pcs > 0 && remaining.cwt > 0)
      .map(({ bag, remaining }) => {
        const baseName = bag.itemid === 3 ? 'DIAMOND'
          : bag.itemid === 4 ? 'COLORSTONE'
            : bag.itemid === 5 ? 'FINDING' : 'MISC';
        return {
          qid: null,
          jid: jobInfo2?.jid ?? null,
          SerialJobNo: val,
          QuotationNo: '',
          item: baseName,
          MaterialTypeName: `${baseName} · Other Bag`,
          itemid: bag.itemid,
          shape: bag.shape || '',
          quality: bag.quality || '',
          color: bag.color_name || '',
          size: bag.size || '',
          findingtypename: bag.findingtypename || '',
          findingAccessories: bag.findingAccessories || '',
          requiredPcs: 0,
          requiredWt: 0,
          isUnusedBag: true,
          isOtherBagAuto: true,
          isExtraEngaged: false,
          requiredBagNotScanned: false,
          requiredBagRfbag: null,
          matchedBag: {
            rfbag: bag.rfbag,
            availPcs: remaining.pcs,
            availWt: remaining.cwt,
            iscompany: bag.iscompany,
          },
          assignedBag: bag.rfbag,
          pcs: '',
          cwt: '',
          txnid: null,
          engagedLocked: false,
        };
      });

    setMaterials([...rows, ...extraMats, ...otherBagRows]);
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
    setMaterials((prev) => prev.map((m, i) => {
      if (i !== idx) return m;
      if (m.engagedLocked) return m;
      const updated = { ...m, [field]: value };
      if (field === 'pcs' && m.matchedBag) {
        const avail = m.matchedBag.availPcs ?? 0;
        const rfbag = m.assignedBag;
        const savedUsed = getSavedBagUsage(state.jobEntries, rfbag, activeJob?.id).pcs;
        let otherRowsUsed = 0;
        prev.forEach((mm, j) => {
          if (j !== idx && rfbag && norm(mm.assignedBag) === norm(rfbag)) {
            otherRowsUsed += parseFloat(mm.pcs) || 0;
          }
        });
        const remaining = avail - savedUsed - otherRowsUsed;
        updated.pcsError = avail > 0 && (parseFloat(value) || 0) > remaining + 1e-6;
      }
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
    setActiveJob({ ...activeJob, locked: false });
  };

  // Auto-save the active job's material entries to context. Called either
  // when the user scans a new job (switching away from the current one) or
  // automatically via useEffect when materials change. Does NOT clear
  // activeJob — the caller decides that.
  const autoSaveActiveJob = () => {
    if (!activeJob) return;
    if (materials.some((m) => m.pcsError || m.cwtError)) return;
    const activeJobJid = (() => {
      const jobInfo = ScannedJobList.find((j) => norm(j.serialjobno) === norm(activeJob.id));
      return jobInfo?.jid ?? null;
    })();
    const entries = materials.map((m) => ({
      qid: m.qid,
      jid: m.jid ?? activeJobJid,
      serialjobno: activeJob.id,
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
      rfbag: m.assignedBag ?? null,
      bag: m.assignedBag ? { rfbag: m.assignedBag } : null,
      iscompany: m.matchedBag?.iscompany ?? null,
      txnid: m.txnid ?? null,
      pcs: parseFloat(m.pcs) || 0,
      wt: parseFloat(m.cwt) || 0,
    }));
    if (actions?.updateJobEntry) actions.updateJobEntry(activeJob.id, { bags: entries });
    setSavedJobs((prev) => {
      const filtered = prev.filter((s) => norm(s.jobId) !== norm(activeJob.id));
      return [...filtered, { jobId: activeJob.id, materials: [...materials] }];
    });
  };

  const handleSaveJob = () => {
    if (!activeJob) return;
    if (materials.some((m) => m.pcsError || m.cwtError)) return;
    if (materials.some((m) => m.assignedBag && !m.engagedLocked && !(parseFloat(m.cwt) > 0))) return;
    autoSaveActiveJob();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 700);
    setActiveJob(null);
    setMaterials([]);
    setTimeout(() => jobInputRef.current?.focus(), 120);
  };

  const assignedCount = materials.filter((m) => m.assignedBag).length;
  const pendingCount = materials.length - assignedCount;

  // Grand totals across every saved job for the right-side summary panel
  const grandTotals = useMemo(() => {
    return savedJobs.reduce((acc, sj) => {
      const t = jobTotals(sj.materials);
      return {
        rows: acc.rows + t.rows,
        engaged: acc.engaged + t.engaged,
        noEngage: acc.noEngage + t.noEngage,
        reqPcs: acc.reqPcs + t.reqPcs,
        reqWt: acc.reqWt + t.reqWt,
        entryPcs: acc.entryPcs + t.entryPcs,
        entryWt: acc.entryWt + t.entryWt,
      };
    }, { rows: 0, engaged: 0, noEngage: 0, reqPcs: 0, reqWt: 0, entryPcs: 0, entryWt: 0 });
  }, [savedJobs]);

  // ── Material type label for display ──────────────────────────
  const matLabel = toMaterialTypeList(state.materialType).length &&
    !toMaterialTypeList(state.materialType).includes('all')
    ? `${materialTypeLabel(state.materialType)} only`
    : 'All Materials';

  // ── Sort: group by item type, engaged rows first within each group ──
  const itemOrder = { 3: 1, 4: 2, 5: 3, 7: 4 }; // Diamond, Colorstone, Finding, Misc

  const sortedMaterials = useMemo(() => {
    return materials
      .map((m, idx) => ({ ...m, __idx: idx }))
      .sort((a, b) => {
        // Other Bag rows always last
        const aOther = a.isOtherBagAuto ? 1 : 0;
        const bOther = b.isOtherBagAuto ? 1 : 0;
        if (aOther !== bOther) return aOther - bOther;

        // Group by item type
        const typeCompare = (itemOrder[a.itemid] || 999) - (itemOrder[b.itemid] || 999);
        if (typeCompare !== 0) return typeCompare;

        // Engaged rows first
        const aEngaged = (a.engagedLocked || a.engagedBypass) ? 0 : 1;
        const bEngaged = (b.engagedLocked || b.engagedBypass) ? 0 : 1;
        if (aEngaged !== bEngaged) return aEngaged - bEngaged;

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

  useGlobalScanner(jobInputRef, handleJobScan);

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
      <div className="sbe-wrap">
        {/* ── Job scan bar ── */}
        <ScannerInput
          ref={jobInputRef}
          value={jobScanValue}
          onChange={(e) => { setJobScanValue(e.target.value); setJobError(''); }}
          onKeyDown={handleJobKeyDown}
          onSubmit={handleJobScan}
          placeholder="Scan job barcode (must be from Scan Jobs page)..."
          label="Scan Job"
          buttonLabel="Add Job"
          error={jobError}
          autoFocus
        />

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

                <span>Design#:</span>
                <strong>{activeJob.Designno}</strong>

                <span> Serial for:</span>
                <strong>{activeJob.Serialfor}</strong>
                <span>Customer:</span>
                <strong>{activeJob.customerCode}</strong>
                <span>Metal:</span>
                <strong>{activeJob.metal || '—'}</strong>
                <span>Color:</span>
                <strong>{activeJob.metalColor || '—'}</strong>
                <span> Current Status:</span>
                <strong>{activeJob.CurrentStatus}</strong>
              </div>
              <div className="sbe-card__badges">
                {(pendingCount > 0 || materials.length === 0) && (
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
                    <span className="sbe-table__empty-hint">
                      Click <strong>Add Other Bag</strong> above to engage other material for this job.
                    </span>
                  </div>
                ) : (
                  sortedMaterials.map((mat, idx) => {
                    const has = !!mat.assignedBag;
                    const isEngagedLocked = mat.engagedLocked && has;
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
                          {isEngagedLocked
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
                            : noBagBlocked
                              ? <span className="sbe-exhausted-cell">Bag not scanned</span>
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
                          {isEngagedLocked
                            ? <span className="sbe-engaged-val">{mat.cwt ?? '—'}</span>
                            : noBagBlocked
                              ? <span className="sbe-exhausted-cell">Bag not scanned</span>
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

            {/* Auto-save: no manual save button. Changes are persisted
                automatically via useEffect on materials change. */}
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
          {activeJob && (
            <div className="sbe-saved__current-img">
              <img
                src={activeJob.imagepath || defaultJobImg}
                alt={`Design ${activeJob.id}`}
                onError={(e) => { e.currentTarget.src = defaultJobImg; }}
              />
            </div>
          )}
          <div className="sbe-saved__title"><CheckCircle2 size={14} />Total Summary</div>

          {/* Per-job totals only — no material line list */}
          {savedJobs.map((sj, i) => {
            const t = jobTotals(sj.materials);
            return (
              <div key={i} className="sbe-saved__job">
                <div className="sbe-saved__job-head">
                  <strong>{sj.jobId}</strong>
                  <span className="sbe-saved__meta">
                    {t.engaged}/{t.rows} engaged
                    {t.noEngage > 0 && <span className="sbe-saved__no-bag-pill">{t.noEngage} No Engage</span>}
                  </span>
                </div>
                <div className="sbe-saved__stats">
                  <div className="sbe-saved__stat">
                    <span>PCS</span>
                    <b>{t.entryPcs}</b>
                    <i>/ {t.reqPcs}</i>
                  </div>
                  <div className="sbe-saved__stat">
                    <span>CTW</span>
                    <b>{t.entryWt.toFixed(3)}</b>
                    <i>/ {t.reqWt.toFixed(3)}</i>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Grand total across every saved job */}
          <div className="sbe-saved__grand">
            <div className="sbe-saved__grand-head">
              Grand Total · {savedJobs.length} job{savedJobs.length > 1 ? 's' : ''}
            </div>
            <div className="sbe-saved__stats">
              <div className="sbe-saved__stat">
                <span>PCS</span>
                <b>{grandTotals.entryPcs}</b>
                <i>/ {grandTotals.reqPcs}</i>
              </div>
              <div className="sbe-saved__stat">
                <span>CTW</span>
                <b>{grandTotals.entryWt.toFixed(3)}</b>
                <i>/ {grandTotals.reqWt.toFixed(3)}</i>
              </div>
              <div className="sbe-saved__stat">
                <span>ENGAGED</span>
                <b>{grandTotals.engaged}</b>
                <i>/ {grandTotals.rows}</i>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleBulkEntry;