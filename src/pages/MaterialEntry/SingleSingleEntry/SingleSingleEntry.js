import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ScanLine, Save, PackageOpen, CheckCircle2,
  Gem, Palette, Wrench, Package, AlertCircle, Pencil, X, RotateCcw, PackagePlus
} from 'lucide-react';
import Button from '@mui/material/Button';
import './SingleSingleEntry.scss';
import { getMaster, isMasterKey } from '../../../Utils/masterStore';


const getSession = (key) => {
  if (isMasterKey(key)) return getMaster(key, []);
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
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
  const txnids = [...new Set(
    matches.map((e) => e.txnid).filter((t) => t !== undefined && t !== null && t !== '')
  )];
  const txnid = txnids.length ? txnids.join(',') : null;
  return { pcs, wt, txnid };
};

const getItemLabel = (itemid) => {
  switch (itemid) {
    case 3: return 'Diamond';
    case 4: return 'Colorstone';
    case 5: return 'Finding';
    case 7: return 'Misc';
    default: return 'Unknown';
  }
};

const getMaterialIcon = (itemid, size = 16) => {
  switch (itemid) {
    case 3: return <Gem size={size} />;
    case 4: return <Palette size={size} />;
    case 5: return <Wrench size={size} />;
    default: return <Package size={size} />;
  }
};

const getMaterialColor = (itemid) => {
  switch (itemid) {
    case 3: return '#e91e63';
    case 4: return '#9c27b0';
    case 5: return '#ff9800';
    default: return '#607d8b';
  }
};

const MATERIAL_TYPE_FILTER = { diamond: [3], colorstone: [4], misc: [7], findings: [5] };
const getAllowedItemIds = (materialType) =>
  materialType === 'all' ? null : (MATERIAL_TYPE_FILTER[materialType] ?? null);

const getMaterialLinesForJob = (serialJobNo, ScannedMaterials, requiredBags = [], scannedBags = [], materialType = 'all') => {
  const allowedItemIds = getAllowedItemIds(materialType);
  const scannedRfbagSet = new Set(scannedBags.map((b) => norm(b.rfbag)));
  return ScannedMaterials.filter(
    (m) => norm(m.SerialJobNo) === norm(serialJobNo)
  ).filter(
    (m) => !allowedItemIds || allowedItemIds.includes(m.itemid)
  ).map((m) => {
    const lineRequiredBags = requiredBags.filter(
      (rb) => rb.qid === m.qid && rb.jid === m.jid
    );
    const anyScanned = lineRequiredBags.some((rb) => scannedRfbagSet.has(norm(rb.rfbag)));
    const hasRequired = lineRequiredBags.length > 0;
    return {
      lineKey: `${m.qid}_${m.jid}`,
      qid: m.qid,
      jid: m.jid,
      SerialJobNo: m.SerialJobNo,
      QuotationNo: m.QuotationNo,
      itemid: m.itemid,
      material: getItemLabel(m.itemid),
      shape: m.shape || '',
      quality: m.Quality || '',
      color: m.color || '',
      size: m.size || m.customsize || '',
      findingtypename: m.findingtypename || '',
      findingAccessories: m.findingAccessories || '',
      reqPcs: m.pcs ?? 0,
      reqWt: m.wt ?? 0,
      requiredBagNotScanned: hasRequired && !anyScanned,
      requiredBagRfbag: (hasRequired && !anyScanned) ? lineRequiredBags[0].rfbag : null,
      isUnusedBag: !hasRequired,
      MaterialTypeName: m.MaterialTypeName || '',
      assignedBag: null,
      txnid: null,
    };
  });
};

const tryAutoMatch = (material, ScannedBags) => {
  const byKey = ScannedBags.find(
    (bag) => bag.qid === material.qid && bag.jid === material.jid
  );
  if (byKey) return byKey;
  const isFinding = material.itemid === 5;
  return ScannedBags.find((bag) => {
    if (bag.itemid !== material.itemid) return false;
    if (isFinding) {
      return (
        norm(bag.findingtypename || '') === norm(material.findingtypename) &&
        norm(bag.findingAccessories || '') === norm(material.findingAccessories)
      );
    }
    return (
      norm(bag.shape) === norm(material.shape) &&
      norm(bag.quality) === norm(material.quality) &&
      norm(bag.color_name || bag.color || '') === norm(material.color) &&
      norm(bag.size) === norm(material.size)
    );
  }) ?? null;
};

const lookupBagFromPool = (rfbagVal, ScannedBags, AllBagListData) => {
  const inScanned = ScannedBags.find(
    (b) => norm(b.rfbag) === norm(rfbagVal) || norm(b.rfbag).endsWith(norm(rfbagVal))
  );
  if (inScanned) return inScanned;

  const inAll = AllBagListData.find(
    (b) => norm(b.rfbag) === norm(rfbagVal) || norm(b.rfbag).endsWith(norm(rfbagVal))
  );
  if (inAll) {
    return {
      rfbag: inAll.rfbag,
      itemid: inAll.itemid,
      shape: inAll.shape,
      quality: inAll.Quality,
      size: inAll.Size,
      color_name: inAll.color,
      remwt: inAll.remwt ?? inAll.wt ?? 0,
      rempcs: inAll.rempcs ?? inAll.pcs ?? 0,
      LockerName: inAll.LockerName || '',
      iscompany: inAll.iscompany,
      istoreCust_CustName: inAll.istoreCust_CustName || '',
      findingtypename: inAll.findingtypename || '',
      findingAccessories: inAll.findingAccessories || '',
    };
  }
  return null;
};


const SingleSingleEntry = ({ state, actions }) => {
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

  const [phase, setPhase] = useState('scan-job');
  const [jobScanValue, setJobScanValue] = useState('');
  const [jobError, setJobError] = useState('');

  const [activeJob, setActiveJob] = useState(null);
  const [materialLines, setMaterialLines] = useState([]);
  const [activeLineKey, setActiveLineKey] = useState(null);

  // "Add Other Bag" flow: true while waiting for the user to scan a bag
  // for a brand-new job-wise line. No row is added to materialLines until
  // a valid bag has actually been scanned & assigned.
  const [addingOtherBag, setAddingOtherBag] = useState(false);

  const [assignScanValue, setAssignScanValue] = useState('');
  const [assignError, setAssignError] = useState('');

  const [pcsValue, setPcsValue] = useState('');
  const [wtValue, setWtValue] = useState('');
  const [pcsError, setPcsError] = useState('');
  const [wtError, setWtError] = useState('');
  const [engagedInputLocked, setEngagedInputLocked] = useState(false);
  const [engagedPrefilled, setEngagedPrefilled] = useState(false);
  const skipEngagedRef = useRef(false);
  const activeTxnidRef = useRef(null);

  const [editingLineKey, setEditingLineKey] = useState(null);
  const [completedJobs, setCompletedJobs] = useState(() =>
    Object.keys(state.jobEntries ?? {})
  );
  const [showSaveAnim, setShowSaveAnim] = useState(false);

  const jobInputRef = useRef(null);
  const assignInputRef = useRef(null);
  const pcsInputRef = useRef(null);

  useEffect(() => {
    if (phase === 'scan-job') setTimeout(() => jobInputRef.current?.focus(), 80);
    if (phase === 'assign-bag') setTimeout(() => assignInputRef.current?.focus(), 80);
    if (phase === 'enter-data') setTimeout(() => pcsInputRef.current?.focus(), 80);
  }, [phase]);

  const totalLines = materialLines.length;
  const savedLines = materialLines.filter((l) => l.entry !== null && l.entry !== undefined).length;
  const progress = totalLines > 0 ? Math.round((savedLines / totalLines) * 100) : 0;
  const activeLine = materialLines.find((l) => l.lineKey === activeLineKey) ?? null;

  const activeJobQuotation = activeJob
    ? (ScannedMaterials.find(
      (m) => norm(m.SerialJobNo) === norm(activeJob.id)
    )?.QuotationNo ?? '')
    : '';

  // Collects rfbags already saved/used on ANY job so a bag isn't
  // auto-suggested twice across different jobs.
  const getUsedBagRfbags = (jobEntries) => {
    const used = new Set();
    Object.values(jobEntries || {}).forEach((je) => {
      (je.bags || []).forEach((b) => {
        if (b.rfbag) used.add(norm(b.rfbag));
      });
    });
    return used;
  };


  const getOtherBagLinesForJob = (serialJobNo, otherBags, ScannedJobList, excludeRfbags) => {
    const jobInfo = ScannedJobList.find((j) => norm(j.serialjobno) === norm(serialJobNo));
    const jobCcode = norm(jobInfo?.ccode || '');

    return (otherBags || [])
      .filter((bag) => bag.rfbag && !excludeRfbags.has(norm(bag.rfbag)))
      .filter((bag) => {
        if (bag.iscompany === 1 || bag.iscompany === undefined) return true;
        return jobCcode !== '' && norm(bag.istoreCust_Customercode || '') === jobCcode;
      })
      .map((bag, idx) => ({
        lineKey: `otherbag-${norm(bag.rfbag)}-${idx}`,
        itemid: bag.itemid,
        material: bag.type || getItemLabel(bag.itemid),
        MaterialTypeName: null,
        shape: bag.shape || '',
        quality: bag.quality || '',
        color: bag.color_name || '',
        size: bag.size || '',
        findingtypename: bag.findingtypename || '',
        findingAccessories: bag.findingAccessories || '',
        reqPcs: 0,
        reqWt: 0,
        isUnusedBag: true,
        isOtherBagAuto: true,
        assignedBag: {
          rfbag: bag.rfbag,
          itemid: bag.itemid,
          shape: bag.shape,
          quality: bag.quality,
          size: bag.size,
          color_name: bag.color_name,
          LockerName: bag.LockerName || '',
          stockPcs: bag.rempcs ?? 0,
          stockWt: bag.remwt ?? 0,
          iscompany: bag.iscompany,
        },
        entry: null,
        txnid: null,
        requiredBagNotScanned: false,
      }));
  };

  const handleJobScan = () => {
    const val = jobScanValue.trim();
    if (!val) return;
    setJobError('');
    setAddingOtherBag(false);

    if (!isValidScannedJob(val)) {
      setJobError(`Job "${val}" was not scanned in Step 4.`);
      setJobScanValue('');
      return;
    }

    if (completedJobs.includes(norm(val))) {
      const lines = getMaterialLinesForJob(val, ScannedMaterials, state.requiredBags, state.scannedBags, state.materialType);
      const jobEntry = state.jobEntries?.[norm(val)];

      const restored = lines.map((line) => {
        const saved = jobEntry?.bags?.find((b) => b.lineKey === line.lineKey);
        return {
          ...line,
          assignedBag: saved?.bag ?? null,
          entry: saved ? { pcs: saved.pcs, wt: saved.wt } : null,
          txnid: saved?.txnid ?? null,
        };
      });

      // Bring back any saved "other bag" / extra-engaged lines that
      // aren't part of the required-material list, so they don't
      // vanish when reopening a completed job.
      const restoredExtras = (jobEntry?.bags || [])
        .filter((b) => !lines.some((l) => l.lineKey === b.lineKey))
        .map((b) => ({
          lineKey: b.lineKey,
          itemid: b.itemid,
          material: getItemLabel(b.itemid),
          MaterialTypeName: null,
          shape: b.shape || '',
          quality: b.quality || '',
          color: b.color || '',
          size: b.size || '',
          findingtypename: '',
          findingAccessories: '',
          reqPcs: 0,
          reqWt: 0,
          isUnusedBag: true,
          assignedBag: b.bag,
          entry: { pcs: b.pcs, wt: b.wt },
          txnid: b.txnid ?? null,
          requiredBagNotScanned: false,
        }));

      setActiveJob({ id: val, locked: true });
      setMaterialLines([...restored, ...restoredExtras]);
      setActiveLineKey(null);
      setJobScanValue('');
      setPhase('job-done');
      return;
    }

    const lines = getMaterialLinesForJob(val, ScannedMaterials, state.requiredBags, state.scannedBags, state.materialType);

    const withAutoMatch = lines.map((line) => {
      const matched = tryAutoMatch(line, ScannedBags);
      if (!matched) {
        const engagedRows = (AllEngagedMaterial || []).filter(e => {
          if (!e.isengage) return false;
          if (norm(e.serialjobno) !== norm(val)) return false;
          if (e.itemid !== line.itemid) return false;
          if (line.itemid === 5) {
            return norm(e.findingtypename || '') === norm(line.findingtypename || '') &&
              norm(e.findingAccessories || '') === norm(line.findingAccessories || '');
          }
          return norm(e.shape || '') === norm(line.shape || '') &&
            norm(e.Quality || '') === norm(line.quality || '') &&
            norm(e.color || '') === norm(line.color || '') &&
            norm(e.Size || '') === norm(line.size || '');
        });

        if (engagedRows.length > 0) {
          const engRfbag = engagedRows[0].rfbag;
          const rawBag = lookupBagFromPool(engRfbag, ScannedBags, AllBagListData);
          const bagObj = rawBag
            ? {
              rfbag: rawBag.rfbag,
              itemid: rawBag.itemid,
              shape: rawBag.shape,
              quality: rawBag.quality || rawBag.Quality || '',
              size: rawBag.size || rawBag.Size || '',
              color_name: rawBag.color_name || rawBag.color || '',
              LockerName: rawBag.LockerName || '',
              stockPcs: rawBag.rempcs ?? rawBag.pcs ?? 0,
              stockWt: rawBag.remwt ?? rawBag.wt ?? 0,
              iscompany: rawBag.iscompany ?? rawBag.iscompany
            }
            : { rfbag: engRfbag, stockPcs: 0, stockWt: 0, LockerName: '' };

          return { ...line, assignedBag: bagObj, entry: null };
        }
      }

      return {
        ...line,
        assignedBag: matched
          ? {
            rfbag: matched.rfbag,
            itemid: matched.itemid,
            shape: matched.shape,
            quality: matched.quality,
            size: matched.size,
            color_name: matched.color_name || matched.color || '',
            LockerName: matched.LockerName || '',
            stockPcs: matched.rempcs ?? matched.pcs ?? Number(matched.scannedPcs ?? 0),
            stockWt: matched.remwt ?? matched.wt ?? Number(matched.scannedCwt ?? 0),
            iscompany: matched.iscompany ?? matched.iscompany
          }
          : null,
        entry: null,
      };
    });

    const allowedItemIds = getAllowedItemIds(state.materialType);
    const engagedGroupMap = {};
    (AllEngagedMaterial || []).forEach(e => {
      if (!e.isengage) return;
      if (norm(e.serialjobno) !== norm(val)) return;
      if (allowedItemIds && !allowedItemIds.includes(e.itemid)) return;
      const key = [
        norm(e.rfbag),
        e.itemid,
        norm(e.shape || ''),
        norm(e.Quality || ''),
        norm(e.color || ''),
        norm(e.Size || ''),
        norm(e.findingtypename || ''),
        norm(e.findingAccessories || ''),
      ].join('|');
      if (!engagedGroupMap[key]) {
        engagedGroupMap[key] = { ...e, totalPcs: 0, totalWt: 0, txnids: new Set() };
      }
      engagedGroupMap[key].totalPcs += Number(e.isspcs || 0);
      engagedGroupMap[key].totalWt += Number(e.isswt || 0);
      if (e.txnid !== undefined && e.txnid !== null && e.txnid !== '') {
        engagedGroupMap[key].txnids.add(e.txnid);
      }
    });
    const extraLines = Object.values(engagedGroupMap).filter(e => {
      return !withAutoMatch.some(line => {
        if (!line.assignedBag || norm(line.assignedBag.rfbag) !== norm(e.rfbag)) return false;
        if (e.itemid !== line.itemid) return false;
        if (line.itemid === 5) {
          return norm(e.findingtypename || '') === norm(line.findingtypename || '') &&
            norm(e.findingAccessories || '') === norm(line.findingAccessories || '');
        }
        return norm(e.shape || '') === norm(line.shape || '') &&
          norm(e.Quality || '') === norm(line.quality || '') &&
          norm(e.color || '') === norm(line.color || '') &&
          norm(e.Size || '') === norm(line.size || '');
      });
    }).map((e, idx) => {
      const rawBag = lookupBagFromPool(e.rfbag, ScannedBags, AllBagListData);
      const txnidList = [...e.txnids];
      return {
        lineKey: `extra-${norm(e.rfbag)}-${e.itemid}-${idx}`,
        itemid: e.itemid,
        material: getItemLabel(e.itemid),
        MaterialTypeName: null,
        shape: e.shape,
        quality: e.Quality,
        color: e.color,
        size: e.Size,
        findingtypename: e.findingtypename || '',
        findingAccessories: e.findingAccessories || '',
        reqPcs: e.totalPcs,
        reqWt: e.totalWt,
        isExtraEngaged: true,
        txnid: txnidList.length ? txnidList.join(',') : null,
        assignedBag: rawBag
          ? {
            rfbag: rawBag.rfbag,
            itemid: rawBag.itemid,
            shape: rawBag.shape,
            quality: rawBag.quality || rawBag.Quality || '',
            size: rawBag.size || rawBag.Size || '',
            color_name: rawBag.color_name || rawBag.color || '',
            LockerName: rawBag.LockerName || '',
            stockPcs: rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0),
            stockWt: rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0),
            iscompany: rawBag.iscompany ?? rawBag.iscompany
          }
          : { rfbag: e.rfbag, stockPcs: 0, stockWt: 0, LockerName: '' },
        entry: null,
        requiredBagNotScanned: false,
      };
    });
    const alreadyAssignedRfbags = new Set(
      [...withAutoMatch, ...extraLines]
        .map((l) => l.assignedBag?.rfbag)
        .filter(Boolean)
        .map(norm)
    );

    const usedElsewhere = getUsedBagRfbags(state.jobEntries);
    const excludeForThisJob = new Set([...alreadyAssignedRfbags, ...usedElsewhere]);

    const otherBagLines = getOtherBagLinesForJob(
      val,
      state.otherBags,
      ScannedJobList,
      excludeForThisJob
    );

    const allLines = [...withAutoMatch, ...extraLines, ...otherBagLines];
    setActiveJob({ id: val, locked: false });
    setMaterialLines(allLines);
    setActiveLineKey(null);
    setAssignScanValue('');
    setAssignError('');
    setJobScanValue('');
    setPhase('assign-bag');
  };

  const prefillEntry = (line, fromEdit = false, jobId = null) => {
    if (!line) return;
    setPcsError('');
    setWtError('');
    if (fromEdit && line.entry) {
      setEngagedInputLocked(false);
      setEngagedPrefilled(false);
      activeTxnidRef.current = line.txnid ?? null;
      setPcsValue(String(line.entry.pcs ?? ''));
      setWtValue(String(line.entry.wt ?? ''));
    } else {
      const resolvedJobId = jobId ?? activeJob?.id ?? null;
      const engaged = !skipEngagedRef.current && resolvedJobId
        ? getEngagedTotals(AllEngagedMaterial, resolvedJobId, line)
        : null;
      skipEngagedRef.current = false;
      if (engaged) {
        setPcsValue(String(engaged.pcs));
        setWtValue(engaged.wt.toFixed(3));
        setEngagedInputLocked(true);
        setEngagedPrefilled(true);
        activeTxnidRef.current = engaged.txnid ?? line.txnid ?? null;
      } else {
        setEngagedInputLocked(false);
        setEngagedPrefilled(false);
        activeTxnidRef.current = line.txnid ?? null;
        setPcsValue(line.reqPcs != null && line.reqPcs !== 0 ? String(line.reqPcs) : '');
        setWtValue(line.reqWt != null && line.reqWt !== 0 ? String(line.reqWt) : '');
      }
    }
  };

  const handleAddOtherBag = () => {
    setMaterialLines((prev) => prev.map((l) =>
      l.lineKey === activeLineKey ? { ...l, assignedBag: null } : l
    ));
    setAddingOtherBag(false);
    setEngagedInputLocked(false);
    setEngagedPrefilled(false);
    skipEngagedRef.current = true;
    activeTxnidRef.current = null;
    setAssignScanValue('');
    setAssignError('');
    setPcsValue('');
    setWtValue('');
    setPcsError('');
    setWtError('');
    setPhase('assign-bag');
  };

  const handleLineClick = (line) => {
    if (activeJob?.locked) return;

    setAddingOtherBag(false);
    setActiveLineKey(line.lineKey);
    setAssignError('');
    setAssignScanValue('');

    const engaged = activeJob?.id
      ? getEngagedTotals(AllEngagedMaterial, activeJob.id, line)
      : null;

    if (!line.assignedBag && !engaged) {
      setPhase('assign-bag');
    } else if (line.entry) {
      setEditingLineKey(line.lineKey);
      prefillEntry(line, true);
      setPhase('enter-data');
    } else {
      prefillEntry(line, false);
      setPhase('enter-data');
    }
  };

  // ── Assign bag: to the active material line, OR create a brand-new
  //    "Other Bag" line once a valid bag has been scanned ───────────
  const handleAssignBag = () => {
    const val = assignScanValue.trim();
    if (!val) return;
    if (!activeLine && !addingOtherBag) return;
    setAssignError('');

    const rawBag = lookupBagFromPool(val, ScannedBags, AllBagListData);
    if (!rawBag) {
      setAssignError(`Bag "${val}" not found in locker data.`);
      setAssignScanValue('');
      assignInputRef.current?.focus();
      return;
    }

    // ── Customer-bag restriction: only allow bags belonging to the
    // CURRENT job's customer, not any customer among all scanned jobs.
    if (rawBag.iscompany === 0) {
      const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(rawBag.rfbag));
      const custCode = allBagFull?.istoreCust_Customercode || '';
      const currentJobInfo = ScannedJobList.find((j) => norm(j.serialjobno) === norm(activeJob.id));
      const currentJobCcode = norm(currentJobInfo?.ccode || '');
      if (custCode && norm(custCode) !== currentJobCcode) {
        setAssignError(`Bag "${rawBag.rfbag}" belongs to "${rawBag.istoreCust_CustName || 'another customer'}" — not allowed for this job's customer.`);
        setAssignScanValue('');
        assignInputRef.current?.focus();
        return;
      }
    }

    // ── Locker restriction: only allow bags from the currently selected locker ──
    const allBagFull = AllBagListData.find((b) => norm(b.rfbag) === norm(rawBag.rfbag));
    const bagLockerName = (rawBag.LockerName || allBagFull?.LockerName || '').replace(/\s/g, '');
    const selectedLockerName = (state.locker?.name || '').replace(/\s/g, '');
    if (bagLockerName && selectedLockerName && bagLockerName !== selectedLockerName) {
      setAssignError(`Bag "${rawBag.rfbag}" belongs to locker "${rawBag.LockerName || allBagFull?.LockerName}" — not allowed for selected locker "${state.locker?.name}".`);
      setAssignScanValue('');
      assignInputRef.current?.focus();
      return;
    }

    const bagObj = {
      rfbag: rawBag.rfbag,
      itemid: rawBag.itemid,
      shape: rawBag.shape,
      quality: rawBag.quality || rawBag.Quality || '',
      size: rawBag.size || rawBag.Size || '',
      color_name: rawBag.color_name || rawBag.color || '',
      findingtypename: rawBag.findingtypename || '',
      findingAccessories: rawBag.findingAccessories || '',
      LockerName: rawBag.LockerName || '',
      stockPcs: rawBag.rempcs ?? rawBag.pcs ?? Number(rawBag.scannedPcs ?? 0),
      stockWt: rawBag.remwt ?? rawBag.wt ?? Number(rawBag.scannedCwt ?? 0),
      iscompany: rawBag.iscompany,
    };

    // ── Case 1: creating a brand-new "Other Bag" line ──
    // Only now — after the bag has been validated — do we add a row to
    // materialLines, filled with the bag's real details, so it never
    // shows as an empty "Free-form bag entry" / "Other Bag" /
    // "No bag available" placeholder.
    if (addingOtherBag) {
      const newLine = {
        lineKey: `other-${Date.now()}`,
        itemid: bagObj.itemid,
        material: getItemLabel(bagObj.itemid),
        MaterialTypeName: null,
        shape: bagObj.shape || '',
        quality: bagObj.quality || '',
        color: bagObj.color_name || '',
        size: bagObj.size || '',
        findingtypename: '',
        findingAccessories: '',
        reqPcs: 0,
        reqWt: 0,
        isUnusedBag: true,
        isExtraEngaged: false,
        assignedBag: bagObj,
        entry: null,
        txnid: null,
        requiredBagNotScanned: false,
      };

      setMaterialLines((prev) => [...prev, newLine]);
      setActiveLineKey(newLine.lineKey);
      setAddingOtherBag(false);
      setAssignScanValue('');

      prefillEntry(newLine, false);
      setPhase('enter-data');
      return;
    }

    // ── Case 2: assigning bag to an existing material line ──
    setMaterialLines((prev) =>
      prev.map((l) => {
        if (l.lineKey !== activeLine.lineKey) return l;
        const base = { ...l, assignedBag: bagObj };
        if (l.isUnusedBag && !l.shape) {
          base.itemid = bagObj.itemid;
          base.material = getItemLabel(bagObj.itemid);
          base.shape = bagObj.shape || '';
          base.quality = bagObj.quality || '';
          base.color = bagObj.color_name || '';
          base.size = bagObj.size || '';
        }
        return base;
      })
    );

    setAssignScanValue('');

    prefillEntry({ ...activeLine, assignedBag: bagObj }, false);
    setPhase('enter-data');
  };

  const handleSave = () => {
    if (!activeLine || !pcsValue || !wtValue || pcsError || wtError) return;
    const wtNum = parseFloat(wtValue);
    if (!(wtNum > 0)) {
      setWtError('Weight (ctw) must be greater than 0');
      return;
    }

    const entry = { pcs: parseFloat(pcsValue), wt: parseFloat(wtValue) };
    const txnid = activeTxnidRef.current ?? activeLine.txnid ?? null;

    const updatedLines = materialLines.map((l) =>
      l.lineKey === activeLine.lineKey ? { ...l, entry, txnid } : l
    );
    setMaterialLines(updatedLines);

    const existing = state.jobEntries?.[activeJob.id]?.bags || [];
    const updatedBags = existing.filter((b) => b.lineKey !== activeLine.lineKey);
    actions.updateJobEntry(activeJob.id, {
      bags: [...updatedBags, {
        lineKey: activeLine.lineKey,
        qid: activeLine.qid,
        jid: activeLine.jid,
        isUnusedBag: activeLine.isUnusedBag,
        itemid: activeLine.itemid || activeLine.assignedBag?.itemid || null,
        shape: activeLine.shape || activeLine.assignedBag?.shape || '',
        quality: activeLine.quality || activeLine.assignedBag?.quality || '',
        color: activeLine.color || activeLine.assignedBag?.color_name || '',
        size: activeLine.size || activeLine.assignedBag?.size || '',
        bag: activeLine.assignedBag,
        rfbag: activeLine.assignedBag?.rfbag,
        iscompany: activeLine.iscompany,
        findingtypename: activeLine.findingtypename || '',
        findingAccessories: activeLine.findingAccessories || '',
        txnid: txnid,
        reqPcs: activeLine.reqPcs ?? 0,
        reqWt: activeLine.reqWt ?? 0,
        ...entry,
      }],
    });

    setShowSaveAnim(true);
    setTimeout(() => setShowSaveAnim(false), 700);

    setEditingLineKey(null);
    setEngagedPrefilled(false);
    activeTxnidRef.current = null;
    setPcsValue('');
    setWtValue('');

    const savedCount = updatedLines.filter((l) => l.entry !== null && l.entry !== undefined).length;
    setActiveLineKey(null);
    setAssignScanValue('');
    setAssignError('');

    if (savedCount >= updatedLines.length) {
      setPhase('job-done');
      return;
    }

    setPhase('assign-bag');
  };

  const handleCancelEdit = () => {
    setEditingLineKey(null);
    setEngagedInputLocked(false);
    setEngagedPrefilled(false);
    skipEngagedRef.current = false;
    activeTxnidRef.current = null;
    setPcsValue('');
    setWtValue('');
    setPcsError('');
    setWtError('');
    const savedCount = materialLines.filter((l) => l.entry).length;
    setPhase(savedCount >= totalLines ? 'job-done' : 'assign-bag');
  };

  const handleFinishJob = () => {
    setCompletedJobs((prev) => [...prev, norm(activeJob.id)]);
    setActiveJob(null);
    setMaterialLines([]);
    setActiveLineKey(null);
    setEditingLineKey(null);
    setAddingOtherBag(false);
    setPcsValue('');
    setWtValue('');
    setPhase('scan-job');
  };

  const sortedMaterialLines = useMemo(() => {
    const materialOrder = {
      Diamond: 1,
      Colorstone: 2,
      Misc: 3,
      Finding: 4,
    };

    return [...materialLines].sort((a, b) => {
      // Other-Bag auto-suggested lines always go last, regardless
      // of assigned/saved status.
      const aOther = a.isOtherBagAuto ? 1 : 0;
      const bOther = b.isOtherBagAuto ? 1 : 0;
      if (aOther !== bOther) {
        return aOther - bOther;
      }

      const aAssigned = a.assignedBag ? 0 : 1;
      const bAssigned = b.assignedBag ? 0 : 1;

      if (aAssigned !== bAssigned) {
        return aAssigned - bAssigned;
      }

      const materialCompare =
        (materialOrder[a.material] || 999) -
        (materialOrder[b.material] || 999);

      if (materialCompare !== 0) {
        return materialCompare;
      }

      const aSaved = a.entry ? 0 : 1;
      const bSaved = b.entry ? 0 : 1;

      if (aSaved !== bSaved) {
        return aSaved - bSaved;
      }

      return 0;
    });
  }, [materialLines]);

  return (
    <div className="sse-root">

      {phase === 'scan-job' && (
        <div className="sse-scan-prompt">
          <div className="sse-scan-card">
            <div className="sse-scan-card__icon"><ScanLine size={44} /></div>
            <h2>Scan Job</h2>
            <p>Scan a job barcode to begin material entry</p>
            <div className="sse-scan-card__row">
              <input
                ref={jobInputRef}
                type="text"
                className="sse-input"
                value={jobScanValue}
                onChange={(e) => { setJobScanValue(e.target.value); setJobError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJobScan()}
                placeholder="Scan job barcode..."
              />
              <Button
                variant="contained"
                onClick={handleJobScan}
                className="sse-btn-scan"
                disabled={!jobScanValue.trim()}
              >
                Scan
              </Button>
            </div>
            {jobError && (
              <div className="sse-error">
                <AlertCircle size={15} /><span>{jobError}</span>
              </div>
            )}
            {ScannedJobList.length > 0 && (
              <div className="sse-scan-card__hint" style={{ color: 'lightgray' }}>
                {ScannedJobList.length} Job{ScannedJobList.length !== 1 ? 's' : ''} Available
              </div>
            )}
          </div>

          {completedJobs.length > 0 && (
            <div className="sse-completed">
              <div className="sse-completed__title">
                <CheckCircle2 size={15} /> Completed Jobs ({completedJobs.length})
              </div>
              <div className="sse-completed__chips">
                {completedJobs.map((id) => (
                  <span key={id} className="sse-completed__chip">{id}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(phase === 'assign-bag' || phase === 'enter-data' || phase === 'job-done') && activeJob && (
        <div className="sse-job-layout">

          <div className="sse-job-bar">
            <div className="sse-job-bar__left">
              <PackageOpen size={18} />
              <span>Job:</span>
              <strong>{activeJob.id}</strong>
              {activeJobQuotation && (
                <span className="sse-job-bar__quote">{activeJobQuotation}</span>
              )}
            </div>
            <div className="sse-job-bar__right">
              <span className="sse-job-bar__progress-text">
                {savedLines}/{totalLines} materials
              </span>
              <div className="sse-job-bar__track">
                <div className="sse-job-bar__fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="sse-job-bar__pct">{progress}%</span>
            </div>
          </div>

          <div className="sse-columns">
            <div className="sse-bags-panel">
              <div className="sse-bags-panel__header">
                <span>Materials</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="sse-bags-panel__count">{savedLines}/{totalLines}</span>
                  <Button
                    size="small"
                    variant="outlined"
                    className="sse-add-bag-header-btn"
                    startIcon={<PackagePlus size={12} />}
                    onClick={() => {
                      setActiveLineKey(null);
                      setEditingLineKey(null);
                      setAddingOtherBag(true);
                      setAssignScanValue('');
                      setAssignError('');
                      setPhase('assign-bag');
                      setTimeout(() => assignInputRef.current?.focus(), 80);
                    }}
                  >
                    Add Other Bag
                  </Button>
                </div>
              </div>

              {materialLines.length === 0 ? (
                <div className="sse-bags-empty">
                  <Package size={28} />
                  <span>No material lines found for this job.</span>
                </div>
              ) : (
                <div className="sse-bags-list">
                  {sortedMaterialLines.map((line) => {
                    console.log('line: ', line);
                    const isSaved = !!line.entry;
                    const isActive = line.lineKey === activeLineKey;
                    const hasBAg = !!line.assignedBag;

                    const isSelectable = hasBAg || line.requiredBagNotScanned;
                    return (
                      <div
                        key={line.lineKey}
                        className={[
                          'sse-bag-row',
                          isSaved ? 'sse-bag-row--saved' : '',
                          isActive ? 'sse-bag-row--active' : '',
                          !hasBAg ? 'sse-bag-row--unassigned' : '',
                          line.isExtraEngaged ? 'sse-bag-row--extra-engaged' : '',
                        ].join(' ')}
                        onClick={() => {
                          if (!activeJob.locked && isSelectable) {
                            handleLineClick(line);
                          }
                        }}
                        style={{
                          cursor: activeJob.locked
                            ? 'default'
                            : isSelectable
                              ? 'pointer'
                              : ''
                        }}
                      >
                        {isSaved
                          && <div
                            className="sse-bag-row__icon"
                            style={{ color: isSaved ? '#22c55e' : getMaterialColor(line.itemid) }}
                          >
                            <CheckCircle2 size={18} />
                            {/* // : getMaterialIcon(line.itemid, 18)} */}
                          </div>}

                        <div className="sse-bag-row__info" style={{ minWidth: '190px' }}>
                          <span className="sse-bag-row__rfbag">
                            {line.isUnusedBag && !line.shape
                              ? 'Free-form bag entry'
                              : `${line.MaterialTypeName ? `${line.MaterialTypeName} · ` : ''}${line.findingtypename ? `${line.findingtypename} ` : ''}${line.findingAccessories ? `${line.findingAccessories} · ` : ''}${line.shape} · ${line.quality} · ${line.color}${line.size ? ` · ${line.size}` : ''}`}
                          </span>
                          <span className="sse-bag-row__desc">
                            {line.material}
                            {line.isExtraEngaged && (
                              <span className="sse-bag-row__extra-badge">Other Engagement</span>
                            )}
                            {line.isOtherBagAuto && (
                              <span className="sse-bag-row__other-bag-badge">Other Bag</span>
                            )}
                          </span>

                          {(() => {
                            const eng = activeJob?.id
                              ? getEngagedTotals(AllEngagedMaterial, activeJob.id, line)
                              : null;
                            return eng ? (
                              <span className="sse-bag-row__engaged">
                                Engaged: {eng.pcs} pcs / {eng.wt.toFixed(3)} ctw
                              </span>
                            ) : null;
                          })()}

                          {hasBAg ? (
                            <span className="sse-bag-row__stock" style={{ display: 'flex', gap: '5px' }}>
                              <span>
                                {line.assignedBag.rfbag}
                              </span>
                              <span>
                                {line.assignedBag.LockerName
                                  ? `${line.assignedBag.LockerName}`
                                  : ''}
                              </span>
                              <span>
                                {line.assignedBag.iscompany == 1
                                  ? `Company`
                                  : 'Customer'}
                              </span>

                            </span>
                          ) : line.requiredBagNotScanned ? (
                            <span className="sse-bag-row__stock sse-bag-row__stock--not-scanned">
                              Required bag not scanned: {line.requiredBagRfbag}
                            </span>
                          ) : (
                            <span className="sse-bag-row__stock sse-bag-row__stock--warn">
                              No bag available - add other bag
                            </span>
                          )}
                        </div>

                        <div className="sse-bag-row__req">
                          <div className="sse-bag-row__req-row">
                            <span className="sse-bag-row__req-label">Req</span>
                            <span className="sse-bag-row__req-val">{line.reqPcs} pcs /</span>
                            <span className="sse-bag-row__req-val">{line.reqWt} ctw</span>
                          </div>
                          {isSaved && (
                            <div className="sse-bag-row__entered-row">
                              <span className="sse-bag-row__entered-label">✓</span>
                              <span className="sse-bag-row__entered-val">{line.entry.pcs} pcs</span>
                              <span className="sse-bag-row__entered-val">{line.entry.wt} ctw</span>
                            </div>
                          )}
                        </div>

                        <div className="sse-bag-row__actions">
                          {/* {isActive && (
                            <span className="sse-bag-row__badge sse-bag-row__badge--active">
                              Active
                            </span>
                          )} */}
                          {isSaved && !isActive && (
                            <button
                              className="sse-bag-row__edit-btn"
                              onClick={(e) => { e.stopPropagation(); handleLineClick(line); }}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {/* {!isSaved && !isActive && !hasBAg && (
                            <span className={`sse-bag-row__badge ${line.requiredBagNotScanned ? 'sse-bag-row__badge--not-scanned' : 'sse-bag-row__badge--warn'}`}>
                              {line.requiredBagNotScanned ? 'Not Scanned' : 'NoBag'}
                            </span>
                          )}
                          {!isSaved && !isActive && hasBAg && (
                            <span className="sse-bag-row__badge sse-bag-row__badge--pending">
                              Enter
                            </span>
                          )} */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sse-entry-panel">

              {(phase === 'assign-bag' || phase === 'enter-data') && !activeLine && !addingOtherBag && (
                <div className="sse-scan-card sse-scan-card--compact">
                  <div className="sse-scan-card__icon sse-scan-card__icon--sm">
                    <Package size={30} />
                  </div>
                  <h3>Select a Material</h3>
                  <p>Click a material line on the left to assign a bag or enter data.</p>
                </div>
              )}

              {/* ── ASSIGN BAG (existing line OR new "Add Other Bag" flow) ── */}
              {phase === 'assign-bag' && (activeLine || addingOtherBag) && (
                <div className="sse-scan-card sse-scan-card--compact">
                  <div className="sse-assign-header">
                    <div
                      className="sse-assign-header__icon"
                      style={{ color: activeLine ? getMaterialColor(activeLine.itemid) : '#607d8b' }}
                    >
                      {activeLine ? getMaterialIcon(activeLine.itemid, 20) : <PackagePlus size={20} />}
                    </div>
                    <div className="sse-assign-header__info">
                      <strong>Assign Bag for:</strong>
                      <span>
                        {addingOtherBag || activeLine?.isUnusedBag
                          ? 'Other Bag (Job-wise entry)'
                          : `${activeLine.material} · ${activeLine.shape} · ${activeLine.quality} · ${activeLine.color}${activeLine.size ? ` · ${activeLine.size}` : ''}`}
                      </span>
                      {activeLine && !activeLine.isUnusedBag && (
                        <span className="sse-assign-header__req">
                          Req: {activeLine.reqPcs} pcs / {activeLine.reqWt} ctw
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sse-scan-card__icon sse-scan-card__icon--sm" style={{ marginTop: 16 }}>
                    <PackagePlus size={30} />
                  </div>
                  <h3>Scan Bag to Assign</h3>
                  <p>Scan a bag barcode to assign it to this material line</p>

                  {activeLine?.requiredBagNotScanned && activeLine.requiredBagRfbag && (
                    <div className="sse-assign-hint sse-assign-hint--not-scanned">
                      <AlertCircle size={14} />
                      <span>Required bag <strong>{activeLine.requiredBagRfbag}</strong> was not scanned in the Bag Scanning step.</span>
                    </div>
                  )}

                  <div className="sse-scan-card__row">
                    <input
                      ref={assignInputRef}
                      type="text"
                      className="sse-input"
                      value={assignScanValue}
                      onChange={(e) => { setAssignScanValue(e.target.value); setAssignError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAssignBag()}
                      placeholder="e.g. 0000002988"
                    />
                    <Button
                      variant="contained"
                      onClick={handleAssignBag}
                      disabled={!assignScanValue.trim()}
                      className="sse-btn-scan"
                    >
                      Assign
                    </Button>
                  </div>

                  {assignError && (
                    <div className="sse-error">
                      <AlertCircle size={14} /><span>{assignError}</span>
                    </div>
                  )}
                </div>
              )}

              {phase === 'enter-data' && activeLine && (
                <div className="sse-data-card">
                  <div className="sse-data-card__header">
                    <div
                      className="sse-data-card__icon"
                      style={{ color: getMaterialColor(activeLine.itemid) }}
                    >
                      {getMaterialIcon(activeLine.itemid, 22)}
                    </div>
                    <div className="sse-data-card__header-text">
                      <strong>
                        {activeLine.assignedBag?.rfbag ?? '—'}
                      </strong>
                      <span>
                        {activeLine.material} · {activeLine.shape} · {activeLine.quality} · {activeLine.size}
                      </span>
                      {activeLine.assignedBag?.LockerName && (
                        <span className="sse-data-card__locker">
                          {activeLine.assignedBag.LockerName}
                        </span>
                      )}
                    </div>
                    {editingLineKey && (
                      <button className="sse-data-card__close" onClick={handleCancelEdit}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {activeLine.assignedBag && (
                    <div className="sse-data-card__stock-row">
                      <span className="sse-data-card__req-label">Stock:</span>
                      <span className="sse-data-card__req-val">
                        {activeLine.assignedBag.stockPcs} pcs
                      </span>
                      <span className="sse-data-card__req-sep">/</span>
                      <span className="sse-data-card__req-val">
                        {activeLine.assignedBag.stockWt} ctw
                      </span>
                    </div>
                  )}

                  <div className="sse-data-card__req-row">
                    <span className="sse-data-card__req-label">Required:</span>
                    <span className="sse-data-card__req-val">{activeLine.reqPcs} pcs</span>
                    <span className="sse-data-card__req-sep">/</span>
                    <span className="sse-data-card__req-val">{activeLine.reqWt} ctw</span>
                  </div>

                  {engagedInputLocked ? (
                    <div className="sse-engaged-lock">
                      <div className="sse-engaged-lock__row">
                        <span className="sse-engaged-lock__label">Already Engaged</span>
                        <span className="sse-engaged-lock__vals">
                          {pcsValue} pcs &nbsp;/&nbsp; {wtValue} ctw
                        </span>
                      </div>
                      <div className="sse-engaged-lock__btns">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<RotateCcw size={13} />}
                          className="sse-btn-return"
                          fullWidth
                          onClick={() => setEngagedInputLocked(false)}
                        >
                          Return / Edit
                        </Button>
                      </div>
                    </div>
                  ) : activeLine.assignedBag &&
                    (activeLine.assignedBag.stockPcs ?? 0) <= 0 &&
                    (activeLine.assignedBag.stockWt ?? 0) <= 0 &&
                    !engagedPrefilled ? (
                    <div className="sse-data-card__exhausted">
                      <AlertCircle size={15} />
                      <span>Available stock is 0 — please scan a different bag</span>
                    </div>
                  ) : (
                    <>
                      <div className="sse-data-card__fields">
                        <div className="sse-field">
                          <label>PCS</label>
                          <input
                            ref={pcsInputRef}
                            type="number"
                            className={`sse-input ${pcsError ? 'sse-input--error' : ''}`}
                            value={pcsValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPcsValue(val);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                document.getElementById('sse-wt-input')?.focus();
                            }}
                            placeholder="Enter PCS"
                          />
                          {pcsError && <span className="sse-field__error">{pcsError}</span>}
                        </div>
                        <div className="sse-field">
                          <label>WT (ctw)</label>
                          <input
                            id="sse-wt-input"
                            type="number"
                            step="0.001"
                            className={`sse-input ${wtError ? 'sse-input--error' : ''}`}
                            value={wtValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWtValue(val);
                              const avail = activeLine?.assignedBag?.stockWt ?? null;
                              if (avail !== null && avail > 0 && (parseFloat(val) || 0) > avail) {
                                setWtError(`Max ${avail} ctw available`);
                              } else { setWtError(''); }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                            placeholder="Enter WT"
                          />
                          {wtError && <span className="sse-field__error">{wtError}</span>}
                        </div>
                      </div>

                      <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!pcsValue || !wtValue || !!pcsError || !!wtError}
                        startIcon={<Save size={15} />}
                        className={`sse-btn-save ${showSaveAnim ? 'sse-btn-save--flash' : ''}`}
                        fullWidth
                      >
                        {editingLineKey ? 'Update Entry' : 'Save & Next'}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {phase === 'job-done' && (
                <div className="sse-job-done">
                  <div className="sse-job-done__icon"><CheckCircle2 size={44} /></div>
                  <h2>{activeJob?.locked ? 'Job Previously Saved' : 'All Materials Done!'}</h2>
                  <p>
                    {savedLines} material{savedLines !== 1 ? 's' : ''} saved for job{' '}
                    <strong>{activeJob.id}</strong>
                  </p>
                  {activeJob?.locked ? (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCompletedJobs((prev) => prev.filter((id) => id !== norm(activeJob.id)));
                        setActiveJob({ ...activeJob, locked: false });
                        setPhase(savedLines >= totalLines ? 'job-done' : 'assign-bag');
                      }}
                      startIcon={<RotateCcw size={16} />}
                      className="sse-btn-return"
                    >
                      Return / Edit
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleFinishJob}
                      startIcon={<Save size={16} />}
                      className="sse-btn-finish"
                    >
                      Save &amp; Scan Next Job
                    </Button>
                  )}
                </div>
              )}

              <div className="sse-footer">
                <Button
                  variant="outlined"
                  onClick={handleFinishJob}
                  startIcon={<Save size={15} />}
                  className="sse-btn-next-job"
                >
                  Save &amp; Scan Next Job
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleSingleEntry;