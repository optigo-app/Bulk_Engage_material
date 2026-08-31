import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEngage } from "../../context/EngageContext";
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
  Stone,
  X,
} from "lucide-react";
import Button from "@mui/material/Button";
import "./BagScanning.scss";
import { getMaster, isMasterKey } from "../../Utils/masterStore";

const getSessionData = (key) => {
  if (isMasterKey(key)) return getMaster(key, []);
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const isSolitaire = (m) => Number(m?.is_sol_gem) === 1;

const getItemLabel = (itemid, isSol = false) => {
  if (itemid === 3 && isSol) return "Diamond:S";
  switch (itemid) {
    case 3:
      return "Diamond";
    case 4:
      return "Colorstone";
    case 5:
      return "Finding";
    case 7:
      return "Misc";
    default:
      return "Unknown";
  }
};

const getItemIcon = (itemid, isSol = false) => {
  if (itemid === 3 && isSol) return Stone;
  switch (itemid) {
    case 3:
      return Gem;
    case 4:
      return Palette;
    case 5:
      return Wrench;
    default:
      return Package;
  }
};

const getItemColor = (itemid, isSol = false) => {
  if (itemid === 3 && isSol) return "#6343f1";
  switch (itemid) {
    case 3:
      return "#e91e63";
    case 4:
      return "#9c27b0";
    case 5:
      return "#ff9800";
    default:
      return "#607d8b";
  }
};

// Normalize for comparison: trim, collapse internal whitespace, uppercase.
// Fixes finding lines silently failing to match (e.g. "Anchor chain  0.5"
// vs "Anchor chain 0.5").
const norm = (v) =>
  (v || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

const matchBagsForItem = (jobMaterial, allBags) => {
  const jobSize = norm(jobMaterial.size || jobMaterial.customsize || "");
  const jobIsSol = isSolitaire(jobMaterial);
  return allBags.filter((bag) => {
    const bagSize = norm(bag.Size || bag.customesize || "");
    const bagIsSol = isSolitaire(bag);
    // Solitaire must match solitaire, non-solitaire must match non-solitaire
    if (jobIsSol !== bagIsSol) return false;
    // For solitaire, also match by stone_uniqueno if available
    if (jobIsSol) {
      const jobUnique = norm(jobMaterial.stone_uniqueno || "");
      const bagUnique = norm(bag.stone_uniqueno || "");
      if (jobUnique && bagUnique && jobUnique !== bagUnique) return false;
    }
    return (
      bag.itemid === jobMaterial.itemid &&
      norm(bag.shape) === norm(jobMaterial.shape) &&
      norm(bag.Quality) === norm(jobMaterial.Quality) &&
      norm(bag.color) === norm(jobMaterial.color) &&
      bagSize === jobSize
    );
  });
};

const matchFindingBags = (jobMaterial, allBags) => {
  return allBags.filter(
    (bag) =>
      bag.itemid === jobMaterial.itemid &&
      norm(bag.shape) === norm(jobMaterial.shape) &&
      norm(bag.Quality) === norm(jobMaterial.Quality) &&
      norm(bag.color) === norm(jobMaterial.color) &&
      norm(bag.findingtype) === norm(jobMaterial.findingtypename) &&
      norm(bag.findingAccessories) === norm(jobMaterial.findingAccessories),
  );
};

const buildRequiredBags = () => {
  const materialLines = (getSessionData("scannedJobMaterialData") || []).filter(
    (material) => material.shape !== "Stamping",
  );
  const allBags = getSessionData("allBagListData");

  if (!materialLines.length) {
    return { available: [], unavailable: [] };
  }

  const available = [];
  const unavailable = [];

  materialLines.forEach((material) => {
    const isFinding = material.itemid === 5;
    const matIsSol = isSolitaire(material);
    const matchedBags = isFinding
      ? matchFindingBags(material, allBags)
      : matchBagsForItem(material, allBags);

    if (matchedBags.length === 0) {
      unavailable.push({
        id: `na-${material.qid}`,
        itemid: material.itemid,
        is_sol_gem: material.is_sol_gem || 0,
        stone_uniqueno: material.stone_uniqueno || "",
        type: getItemLabel(material.itemid, matIsSol),
        color: getItemColor(material.itemid, matIsSol),
        shape: material.shape,
        quality: material.Quality,
        size: material.size || material.customsize || "",
        color_name: material.color,
        findingtypename: material.findingtypename || "",
        findingAccessories: material.findingAccessories || "",
        qid: material.qid,
        jid: material.jid,
        SerialJobNo: material.SerialJobNo,
        QuotationNo: material.QuotationNo,
        materialWt: material.wt,
        materialPcs: material.pcs,
        materialShape: material.shape,
        materialQuality: material.Quality,
        materialColor: material.color,
        materialSize: material.size || material.customsize || "",
      });
      return;
    }

    matchedBags.forEach((bag) => {
      const alreadyAdded = available.find((r) => r.id === bag.rfbag);
      if (!alreadyAdded) {
        const bagIsSol = isSolitaire(bag);
        available.push({
          id: bag.rfbag,
          rfbag: bag.rfbag,
          itemid: bag.itemid,
          is_sol_gem: bag.is_sol_gem || 0,
          stone_uniqueno: bag.stone_uniqueno || "",
          type: getItemLabel(bag.itemid, bagIsSol),
          color: getItemColor(bag.itemid, bagIsSol),
          shape: bag.shape,
          quality: bag.Quality,
          size: bag.Size || bag.customesize || "",
          color_name: bag.color,
          findingtypename: bag.findingtypename || "",
          findingAccessories: bag.findingAccessories || "",
          remwt: bag.remwt,
          rempcs: bag.rempcs,
          LockerName: bag.LockerName,
          iscompany: bag.iscompany,
          istoreCust_CustName: bag.istoreCust_CustName,
          istoreCust_Customercode: bag.istoreCust_Customercode,
          qid: material.qid,
          jid: material.jid,
          SerialJobNo: material.SerialJobNo,
          QuotationNo: material.QuotationNo,
          materialWt: material.wt,
          materialPcs: material.pcs,
          materialShape: material.shape,
          materialQuality: material.Quality,
          materialColor: material.color,
          materialSize: material.size || material.customsize || "",
        });
      }
    });
  });

  console.log('materialLines: ', materialLines);

  return { available, unavailable };
};

const BagScanning = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  console.log('state: ', state);
  const [scanValue, setScanValue] = useState("");
  const [lastScanned, setLastScanned] = useState(null);
  const [lastOtherScanned, setLastOtherScanned] = useState(null);
  const [bagData, setBagData] = useState({});
  const [listVisible, setListVisible] = useState(true);
  const [bagFilter, setBagFilter] = useState("all");
  const [unavailableBags, setUnavailableBags] = useState([]);
  const [availabilityView, setAvailabilityView] = useState("all");
  const [scanMessage, setScanMessage] = useState(null); // { type: 'error', text: '...' }
  const scanMessageTimerRef = useRef(null);
  const alljobdataRef = useRef([]);
  const inputRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const listTimerRef = useRef(null);
  const backBtnRef = useRef(null);
  const continueBtnRef = useRef(null);


  // Restore scanned-bag input values if returning from Material Entry
  useEffect(() => {
    if (state.scannedBags.length === 0) return;

    const savedBagData = getSessionData('scannedBagData');

    setBagData((prev) => {
      let changed = false;
      const restored = { ...prev };

      state.scannedBags.forEach((bag) => {
        if (restored[bag.id]) return; // already have it, skip
        const saved = savedBagData.find((b) => b.rfbag === bag.rfbag);
        restored[bag.id] = {
          pcs: saved?.scannedPcs ?? (bag.rempcs !== undefined ? String(bag.rempcs) : ''),
          cwt: saved?.scannedCwt ?? (bag.remwt !== undefined ? String(bag.remwt) : ''),
        };
        changed = true;
      });

      return changed ? restored : prev; // avoid setState if nothing changed
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scannedBags]);

  useEffect(() => {
    actions.setStep(5);

    if (state.scannedJobs.length === 0) {
      navigate("/scan-jobs");
      return;
    }

    const alljobdata = JSON.parse(
      sessionStorage.getItem("scannedJobListData") || "[]",
    );
    alljobdataRef.current = alljobdata; // add this line
    const required = buildRequiredBags();
    console.log('required: ', required);
    const filterByLockerAndType = (list) =>
      list
        .filter((bag) => {
          const lockerMatch =
            (bag.LockerName || "").replace(/\s/g, "") ===
            (state.locker.name || "").replace(/\s/g, "");
          return bag.LockerName ? lockerMatch : true;
        })
        .filter((bag) => {
          if (bag.iscompany === 1 || bag.iscompany === undefined) return true;
          return alljobdata.some(
            (job) => job.ccode == bag.istoreCust_Customercode,
          );
        })
        .filter((bag) => {
          switch (state.materialType?.toLowerCase()) {
            case "diamond":
              return bag.type === "Diamond";
            case "colorstone":
              return bag.type === "Colorstone";
            case "misc":
              return bag.type === "Misc";
            case "findings":
              return bag.type === "Finding";
            case "solitore":
              return bag.type === "Diamond:S";
            case "all":
            default:
              return true;
          }
        });

    const filteredAvailable = filterByLockerAndType(required.available);
    const filteredUnavailable = filterByLockerAndType(required.unavailable);

    actions.setRequiredBags(filteredAvailable);
    setUnavailableBags(filteredUnavailable);
    inputRef.current?.focus();
    // const filteredAvailable = filterByLockerAndType(required.available);
    // const filteredUnavailable = filterByLockerAndType(required.unavailable);

    // // ── Reconcile dropped material lines ──
    // // A material line (qid) can have ALL of its matched bags filtered
    // // out by locker/owner/type (e.g. every bag for "Lobster lock" sits
    // // in RLocker but the active locker is Locker1). Previously that
    // // line just vanished from both lists, silently shrinking the
    // // "All Material" total (10 → 8 in the 1/8477 example). Instead,
    // // any qid present in required.available but absent from
    // // filteredAvailable gets demoted into "unavailable" so it still
    // // counts and is visible to the user (with a reason).
    // const matchedQidsBeforeFilter = new Set(
    //   required.available.map((b) => b.qid),
    // );
    // const matchedQidsAfterFilter = new Set(filteredAvailable.map((b) => b.qid));
    // const droppedByLockerFilter = [];

    // matchedQidsBeforeFilter.forEach((qid) => {
    //   if (!matchedQidsAfterFilter.has(qid)) {
    //     const sample = required.available.find((b) => b.qid === qid);
    //     if (sample) {
    //       droppedByLockerFilter.push({
    //         id: `na-locker-${qid}`,
    //         itemid: sample.itemid,
    //         type: sample.type,
    //         color: sample.color,
    //         shape: sample.materialShape,
    //         quality: sample.materialQuality,
    //         size: sample.materialSize,
    //         color_name: sample.materialColor,
    //         findingtypename: sample.findingtypename || "",
    //         findingAccessories: sample.findingAccessories || "",
    //         qid: sample.qid,
    //         jid: sample.jid,
    //         SerialJobNo: sample.SerialJobNo,
    //         QuotationNo: sample.QuotationNo,
    //         materialWt: sample.materialWt,
    //         materialPcs: sample.materialPcs,
    //         materialShape: sample.materialShape,
    //         materialQuality: sample.materialQuality,
    //         materialColor: sample.materialColor,
    //         materialSize: sample.materialSize,
    //         reason: "no-bag-in-locker",
    //       });
    //     }
    //   }
    // });

    // const combinedUnavailable = [
    //   ...filteredUnavailable,
    //   ...droppedByLockerFilter,
    // ];

    // actions.setRequiredBags(filteredAvailable);
    // setUnavailableBags(combinedUnavailable);
    // inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scanMessage) {
      clearTimeout(scanMessageTimerRef.current);
      scanMessageTimerRef.current = setTimeout(
        () => setScanMessage(null),
        3500,
      );
    }
    return () => clearTimeout(scanMessageTimerRef.current);
  }, [scanMessage]);

  const checkBagOwnership = (rfbagValue) => {
    const allBags = getSessionData("allBagListData");
    const bag = allBags.find((b) => b.rfbag === rfbagValue);
    if (!bag || bag == undefined) {
      return { ok: false, bag: null };
    }

    if (bag.iscompany === 1 || bag.iscompany === undefined) {
      return { ok: true, bag };
    }

    const belongsToJobCustomer = alljobdataRef.current.some(
      (job) => job.ccode == bag.istoreCust_Customercode,
    );

    return { ok: belongsToJobCustomer, bag };
  };

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

  const handleScan = (scannedBag) => {
    const val = scannedBag ?? scanValue.trim();
    if (!val) return;

    const bag = state.requiredBags.find((b) => b.rfbag === val || b.id === val);
    if (bag) {
      if (!state.scannedBags.find((b) => b.id === bag.id)) {
        actions.addScannedBag(bag);
        setLastScanned(bag.id);
        setLastOtherScanned(null);
        setScanMessage(null);

        setBagData((prev) => ({
          ...prev,
          [bag.id]: {
            pcs: bag.rempcs !== undefined ? String(bag.rempcs) : '',
            cwt: bag.remwt !== undefined ? String(bag.remwt) : '',
          },
        }));

        setListVisible(false);
        clearTimeout(listTimerRef.current);
        listTimerRef.current = setTimeout(() => setListVisible(true), 600);
      }
    } else {
      const ownership = checkBagOwnership(val);

      if (ownership && ownership.ok === false) {
        const text = ownership.bag
          ? `Bag ${val} belongs to ${ownership.bag.istoreCust_CustName || 'another customer'} — not allowed for this job.`
          : `Bag ${val} not found — not allowed for this job.`;

        setScanMessage({ type: 'error', text });
        setScanValue('');
        inputRef.current?.focus();
        return;
      }

      // ── Locker restriction: only allow other bags from the currently
      // selected locker (mirrors SingleSingleEntry's assign-bag check). ──
      if (ownership?.bag) {
        const bagLockerName = (ownership.bag.LockerName || '').replace(/\s/g, '');
        const selectedLockerName = (state.locker?.name || '').replace(/\s/g, '');
        if (bagLockerName && selectedLockerName && bagLockerName !== selectedLockerName) {
          setScanMessage({
            type: 'error',
            text: `Bag ${val} belongs to locker "${ownership.bag.LockerName}" — not allowed for selected locker "${state.locker?.name}".`,
          });
          setScanValue('');
          inputRef.current?.focus();
          return;
        }
      }

      if (!state.otherBags.find((b) => b.id === val)) {
        const foundBag = ownership?.bag;
        const foundIsSol = foundBag ? isSolitaire(foundBag) : false;
        actions.addOtherBag(
          foundBag
            ? {
              id: val,
              rfbag: foundBag.rfbag,
              itemid: foundBag.itemid,
              is_sol_gem: foundBag.is_sol_gem || 0,
              stone_uniqueno: foundBag.stone_uniqueno || "",
              type: getItemLabel(foundBag.itemid, foundIsSol),
              color: getItemColor(foundBag.itemid, foundIsSol),
              shape: foundBag.shape,
              quality: foundBag.Quality,
              size: foundBag.Size || foundBag.customesize || "",
              color_name: foundBag.color,
              findingtypename: foundBag.findingtypename || "",
              findingAccessories: foundBag.findingAccessories || "",
              remwt: foundBag.remwt,
              rempcs: foundBag.rempcs,
              LockerName: foundBag.LockerName,
              iscompany: foundBag.iscompany,
              istoreCust_CustName: foundBag.istoreCust_CustName,
              istoreCust_Customercode: foundBag.istoreCust_Customercode, // ← add this
            }
            : { id: val, label: val, type: "unknown", color: "#ef4444" }
        );
        setLastOtherScanned(val);
        setLastScanned(null);
      }
    }

    setScanValue('');
    inputRef.current?.focus();
  };

  // Un-scan a bag: remove it from the scanned list and drop its captured
  // pcs/cwt data so the summary + progress update accordingly.
  const handleRemoveScan = (bag) => {
    actions.removeScannedBag(bag.id);
    setBagData((prev) => {
      const next = { ...prev };
      delete next[bag.id];
      return next;
    });
    if (lastScanned === bag.id) setLastScanned(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleScan();
  };

  useEffect(() => {
    const onTabKey = (e) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const focusOrder = [
        inputRef.current,
        backBtnRef.current,
        continueBtnRef.current,
      ].filter(Boolean);
      const active = document.activeElement;
      const currentIdx = focusOrder.indexOf(active);
      if (e.shiftKey) {
        const prevIdx = currentIdx <= 0 ? focusOrder.length - 1 : currentIdx - 1;
        focusOrder[prevIdx]?.focus();
      } else {
        const nextIdx = currentIdx >= focusOrder.length - 1 ? 0 : currentIdx + 1;
        focusOrder[nextIdx]?.focus();
      }
    };
    document.addEventListener("keydown", onTabKey);
    return () => document.removeEventListener("keydown", onTabKey);
  }, []);

  const handleContinue = () => {
    const scannedBagData = state.scannedBags.map((bag) => ({
      rfbag: bag.rfbag,
      itemid: bag.itemid,
      is_sol_gem: bag.is_sol_gem || 0,
      stone_uniqueno: bag.stone_uniqueno || "",
      type: bag.type,
      shape: bag.shape,
      quality: bag.quality,
      size: bag.size,
      color_name: bag.color_name,
      LockerName: bag.LockerName,
      iscompany: bag.iscompany,
      istoreCust_CustName: bag.istoreCust_CustName,
      findingtypename: bag.findingtypename,
      findingAccessories: bag.findingAccessories,
      scannedPcs: bagData[bag.id]?.pcs ?? "",
      scannedCwt: bagData[bag.id]?.cwt ?? "",
      qid: bag.qid,
      jid: bag.jid,
      SerialJobNo: bag.SerialJobNo,
      QuotationNo: bag.QuotationNo,
      materialWt: bag.materialWt,
      materialPcs: bag.materialPcs,
      materialShape: bag.materialShape,
      materialQuality: bag.materialQuality,
      materialColor: bag.materialColor,
      materialSize: bag.materialSize,
    }));

    sessionStorage.setItem("scannedBagData", JSON.stringify(scannedBagData));
    navigate("/material-entry");
  };

  const isScanned = (bagId) => state.scannedBags.some((b) => b.id === bagId);

  const filteredBags = useMemo(() => {
    const order = { Diamond: 1, "Diamond:S": 2, Colorstone: 3, Misc: 4, Finding: 5 };

    return [...state.requiredBags]
      .filter((bag) => {
        if (bagFilter === "all") return true;
        if (bagFilter === "company") return bag.iscompany === 1;
        if (bagFilter === "customer") return bag.iscompany === 0;
        return true;
      })
      .sort((a, b) => (order[a.type] || 999) - (order[b.type] || 999));
  }, [state.requiredBags, bagFilter]);

    console.log('filteredBags: ', filteredBags);

  // One card per material LINE (qid) — not per shape/quality/color/size
  // combo — so two distinct material rows that happen to share those
  // attributes (e.g. two finding lines, same gold/18K/yellow spec, but
  // different findingtype) still render as two separate cards.
  const groupedAvailable = useMemo(() => {
    const order = { Diamond: 1, "Diamond:S": 2, Colorstone: 3, Misc: 4, Finding: 5 };
    const map = new Map();

    filteredBags.forEach((bag) => {
      const key = bag.qid;

      if (!map.has(key)) {
        map.set(key, {
          key,
          itemid: bag.itemid,
          type: bag.type,
          color: bag.color,
          shape: bag.materialShape,
          quality: bag.materialQuality,
          color_name: bag.materialColor,
          size: bag.materialSize,
          findingtypename: bag.findingtypename,
          findingAccessories: bag.findingAccessories,
          is_sol_gem: bag.is_sol_gem,
          jobs: new Set(),
          qids: new Set(),
          materialPcs: 0,
          materialWt: 0,
          bagIds: new Set(),
          bags: [],
        });
      }

      const group = map.get(key);

      if (!group.qids.has(bag.qid)) {
        group.qids.add(bag.qid);
        group.materialPcs += Number(bag.materialPcs) || 0;
        group.materialWt += Number(bag.materialWt) || 0;
      }
      if (bag.SerialJobNo) group.jobs.add(bag.SerialJobNo);

      if (!group.bagIds.has(bag.id)) {
        group.bagIds.add(bag.id);
        group.bags.push(bag);
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => (order[a.type] || 999) - (order[b.type] || 999),
    );
  }, [filteredBags]);

  // groupedAvailable.length (one per matched material line) +
  // unavailableBags.length (one per unmatched material line) now
  // always equals the total scannedJobMaterialData lines for the
  // job — 10 for job 1/8477 (2 diamond + 2 colorstone + 2 misc + 4
  // finding), instead of dropping the unmatched ones silently.
  const combinedMaterials = useMemo(() => {
    const order = { Diamond: 1, "Diamond:S": 2, Colorstone: 3, Misc: 4, Finding: 5 };
    return [...groupedAvailable, ...unavailableBags].sort(
      (a, b) => (order[a.type] || 999) - (order[b.type] || 999),
    );
  }, [groupedAvailable, unavailableBags]);

  console.log('combinedMaterials: ', combinedMaterials);

  const scannedCount = state.scannedBags.length;
  const extraCount = state.otherBags.length;
  // Progress compares SCANNED BAGS against the total number of physical bags
  // that exist to be scanned — NOT the material-line count (which produced the
  // nonsensical "6/4"). Count unique required bags so the denominator is the
  // real number of scannable bags.
  const totalBags = new Set(state.requiredBags.map((b) => b.id)).size;
  const progressPct =
    totalBags > 0 ? Math.min((scannedCount / totalBags) * 100, 100) : 0;

  const renderAvailableMaterialCard = (group) => {
    const Icon = getItemIcon(group.itemid, isSolitaire(group));
    const scannedInGroup = group.bags.filter((b) => isScanned(b.id));
    const groupJustScanned = group.bags.some((b) => lastScanned === b.id);

    return (
      <div
        key={`avail-${group.key}`}
        className={[
          "bag-scanning__bag-card",
          "bag-scanning__bag-card--material",
          scannedInGroup.length === group.bags.length
            ? "bag-scanning__bag-card--scanned"
            : "",
          groupJustScanned ? "bag-scanning__bag-card--just-scanned" : "",
        ].join(" ")}
      >
        <div className="bag-scanning__bag-info">
          <span className="bag-scanning__bag-type">
            {group.type} · {group.shape} · {group.quality} · {group.color_name} · {group.size}
          </span>
          <span className="bag-scanning__bag-meta">
            {group.findingAccessories ? ` ${group.findingAccessories}` : ""} {group.findingtypename ? ` · ${group.findingtypename}` : ""}
          </span>
          <span className="bag-scanning__bag-meta">
            Job{group.jobs.size > 1 ? "s" : ""}:{" "}
            {Array.from(group.jobs).join(", ")} · Req: {group.materialPcs} pcs /{" "}
            {group.materialWt} {group.type == "Misc" || group.type == "Finding" ? "gms" : 'ctw'}
          </span>

          <span className="bag-scanning__bag-chip-list">
            RM:&nbsp;
            {group.bags.map((bag, idx) => {
              const scanned = isScanned(bag.id);
              const justScanned = lastScanned === bag.id;
              return (
                <React.Fragment key={bag.id}>
                  <span
                    role="button"
                    tabIndex={0}
                    className={[
                      "bag-scanning__bag-chip",
                      scanned ? "bag-scanning__bag-chip--scanned" : "",
                      justScanned ? "bag-scanning__bag-chip--just-scanned" : "",
                    ].join(" ")}
                    title={[bag.LockerName, bag.istoreCust_CustName]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={() => { if (!scanned) handleScan(bag.rfbag); }}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !scanned)
                        handleScan(bag.rfbag);
                    }}
                  >
                    {scanned && <CheckCircle2 size={11} />} {bag.rfbag}
                    {scanned && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="bag-scanning__bag-chip-remove"
                        title="Remove scan"
                        onClick={(e) => { e.stopPropagation(); handleRemoveScan(bag); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            handleRemoveScan(bag);
                          }
                        }}
                      >
                        <X size={11} />
                      </span>
                    )}
                  </span>
                </React.Fragment>
              );
            })}
          </span>

          {scannedInGroup.length > 0 && (
            <div className="bag-scanning__bag-inputs-group">
              {scannedInGroup.map((bag) => (
                <div className="bag-scanning__bag-inputs" key={bag.id}>
                  <span className="bag-scanning__bag-inputs-tag">
                    {bag.rfbag}
                  </span>
                  <div className="bag-scanning__bag-field-wrap">
                    <label>Rem. PCS</label>
                    <input
                      type="number"
                      className="bag-scanning__bag-field bag-scanning__bag-field--disabled"
                      value={bagData[bag.id]?.pcs ?? ""}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="bag-scanning__bag-field-wrap">
                    <label>Rem. Wt (ctw)</label>
                    <input
                      type="number"
                      step="0.001"
                      className="bag-scanning__bag-field bag-scanning__bag-field--disabled"
                      value={bagData[bag.id]?.cwt ?? ""}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bag-scanning__bag-status">
          <span className="bag-scanning__bag-badge bag-scanning__bag-badge--available">
            Available ({group.bags.length})
          </span>
          <span className="bag-scanning__bag-badge bag-scanning__bag-badge--scan-progress">
            {scannedInGroup.length}/{group.bags.length} Scanned
          </span>
        </div>
      </div>
    );
  };

  const renderUnavailableMaterialCard = (mat) => {
    const Icon = getItemIcon(mat.itemid, isSolitaire(mat));
    return (
      <div
        key={`unavail-${mat.id}`}
        className="bag-scanning__bag-card bag-scanning__bag-card--unavailable"
      >
        <div className="bag-scanning__bag-info">
          <span className="bag-scanning__bag-id">
            No bag found
          </span>
          <span className="bag-scanning__bag-type">
            {mat.type} · {mat.shape} · {mat.quality} · {mat.color_name} · {mat.size}
          </span>
          <span className="bag-scanning__bag-meta">
            {mat.findingtypename ? ` · ${mat.findingtypename}` : ""}
          </span>
          <span className="bag-scanning__bag-meta">
            Job: {mat.SerialJobNo} · Req: {mat.materialPcs} pcs /{" "}
            {mat.materialWt} ctw
          </span>
        </div>

        <div className="bag-scanning__bag-status">
          <span className="bag-scanning__bag-badge bag-scanning__bag-badge--not-available">
            Not Available
          </span>
          {/* <span className="bag-scanning__bag-badge bag-scanning__bag-badge--not-available">
            {mat.reason === "no-bag-in-locker"
              ? "Wrong Locker"
              : "Not Available"}
          </span> */}
        </div>
      </div>
    );
  };

  return (
    <div className="bag-scanning page-enter">
      <div className="bag-scanning__header">
        <div className="bag-scanning__step-badge">Step 5</div>
        <h1 className="bag-scanning__title">Bag Scanning</h1>
        <p className="bag-scanning__desc">
          Scan the available bags for the scanned jobs
        </p>
      </div>

      <div className="bag-scanning__layout">
        <div className="bag-scanning__left">
          {state.scannedJobs.length > 0 && (
            <div className="bag-scanning__jobs-context">
              <span className="bag-scanning__jobs-context-label">
                Jobs:
              </span>
              <div className="bag-scanning__jobs-chips">
                {state.scannedJobs.map((j) => (
                  <span key={j.id} className="bag-scanning__job-chip">
                    {j.id}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bag-scanning__info-card">
            <h3>Scan Summary</h3>
            <div className="bag-scanning__summary-grid">
              <div className="bag-scanning__summary-item bag-scanning__summary-item--scanned">
                <span className="bag-scanning__summary-value">
                  {scannedCount}
                </span>
                <span className="bag-scanning__summary-label">Scanned</span>
              </div>
              <div className="bag-scanning__summary-item bag-scanning__summary-item--required">
                <span className="bag-scanning__summary-value">
                  {combinedMaterials.length}
                </span>
                <span className="bag-scanning__summary-label">AllMaterial</span>
              </div>
              <div className="bag-scanning__summary-item bag-scanning__summary-item--missing">
                <span className="bag-scanning__summary-value">
                  {unavailableBags.length}
                </span>
                <span className="bag-scanning__summary-label">Missing</span>
              </div>
              <div className="bag-scanning__summary-item bag-scanning__summary-item--extra">
                <span className="bag-scanning__summary-value">
                  {extraCount}
                </span>
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
              {scannedCount}/{totalBags} bags scanned
            </div>
          </div>

          <div className="bag-scanning__scan-area">
            <div className="bag-scanning__scan-frame">
              <div className="bag-scanning__scan-animation">
                <div className="bag-scanning__scan-box">
                  <Package size={28} />
                </div>
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

            {scanMessage && (
              <div
                className={`bag-scanning__scan-message bag-scanning__scan-message--${scanMessage.type}`}
              >
                <AlertTriangle size={14} />
                <span>{scanMessage.text}</span>
              </div>
            )}
          </div>

          {state.requiredBags.length === 0 && (
            <div className="bag-scanning__no-bags">
              <AlertTriangle size={28} />
              <p>No matching bags found for the scanned job material(s).</p>
              <span>Verify job selection or check bag data.</span>
            </div>
          )}
        </div>

        <div className="bag-scanning__right">
          <div className="bag-scanning__section">
            <div className="bag-scanning__filter-pills">
              {["all", "available", "unavailable"].map((v) => (
                <button
                  key={v}
                  className={[
                    "bag-scanning__filter-pill",
                    availabilityView === v
                      ? "bag-scanning__filter-pill--active"
                      : "",
                  ].join(" ")}
                  onClick={() => setAvailabilityView(v)}
                >
                  {v === "all"
                    ? `All Material (${combinedMaterials.length})`
                    : v === "available"
                      ? `Available (${groupedAvailable.length})`
                      : `Not Available (${unavailableBags.length})`}
                </button>
              ))}
            </div>

            <div className="bag-scanning__filter-pills">
              {["all", "company", "customer"].map((f) => (
                <button
                  key={f}
                  className={[
                    "bag-scanning__filter-pill",
                    bagFilter === f ? "bag-scanning__filter-pill--active" : "",
                  ].join(" ")}
                  onClick={() => setBagFilter(f)}
                >
                  {f === "all"
                    ? "All"
                    : f === "company"
                      ? "Company"
                      : "Customer"}
                </button>
              ))}
            </div>

            <div
              className={`bag-scanning__bags-list ${listVisible ? "bag-scanning__bags-list--visible" : "bag-scanning__bags-list--hidden"}`}
            >
              {availabilityView === "unavailable" ? (
                unavailableBags.length === 0 ? (
                  <div className="bag-scanning__empty-list">
                    <CheckCircle2 size={24} />
                    <span>All required materials have matching bags.</span>
                  </div>
                ) : (
                  unavailableBags.map(renderUnavailableMaterialCard)
                )
              ) : availabilityView === "all" ? (
                combinedMaterials.length === 0 ? (
                  <div className="bag-scanning__empty-list">
                    <Package size={24} />
                    <span>No materials found.</span>
                  </div>
                ) : (
                  combinedMaterials.map((item) =>
                    Array.isArray(item.bags)
                      ? renderAvailableMaterialCard(item)
                      : renderUnavailableMaterialCard(item),
                  )
                )
              ) : groupedAvailable.length === 0 ? (
                <div className="bag-scanning__empty-list">
                  <Package size={24} />
                  <span>No bags available.</span>
                </div>
              ) : (
                groupedAvailable.map(renderAvailableMaterialCard)
              )}
            </div>
          </div>
          {state.otherBags.length > 0 && (
            <div className="bag-scanning__section bag-scanning__section--others">
              <div className="bag-scanning__bags-header bag-scanning__bags-header--others">
                <h3>
                  <AlertTriangle size={16} />
                  &nbsp;Other Bags
                </h3>
                <span className="bag-scanning__bags-count bag-scanning__bags-count--others">
                  {state.otherBags.length}
                </span>
              </div>
              <div className="bag-scanning__bags-list">
                {state?.otherBags.map((bag) => {
                  const justScanned = lastOtherScanned === bag.id;
                  const hasDetails = !!bag.shape; // only true when we matched a real bag record
                  const Icon = hasDetails ? getItemIcon(bag.itemid, isSolitaire(bag)) : PackagePlus;

                  return (
                    <div
                      key={bag.id}
                      className={[
                        "bag-scanning__bag-card",
                        "bag-scanning__bag-card--other",
                        justScanned ? "bag-scanning__bag-card--just-scanned-other" : "",
                      ].join(" ")}
                    >
                      <div className="bag-scanning__bag-info">
                        <span className="bag-scanning__bag-id">{bag.rfbag || bag.id}</span>

                        {hasDetails ? (
                          <>
                            <span className="bag-scanning__bag-type">
                              {bag.type} · {bag.shape} · {bag.quality} · {bag.color_name} · {bag.size}
                              {bag.findingtypename ? ` · ${bag.findingtypename}` : ""}
                            </span>
                            <span className="bag-scanning__bag-meta">
                              Rem: {bag.rempcs ?? "-"} pcs / {bag.remwt ?? "-"} ctw
                              {bag.LockerName ? ` · ${bag.LockerName}` : ""}
                              {bag.istoreCust_CustName ? ` · ${bag.istoreCust_CustName}` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="bag-scanning__bag-type">Not in required list</span>
                        )}
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

      <div className="bag-scanning__actions">
        <Button
          variant="outlined"
          onClick={() => navigate("/scan-jobs")}
          startIcon={<ArrowLeft size={18} />}
          className="bag-scanning__back-btn"
          ref={continueBtnRef}
        >
          Back
        </Button>
        <Button
          ref={backBtnRef}
          variant="contained"
          color="primary"
          size="large"
          onClick={handleContinue}
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