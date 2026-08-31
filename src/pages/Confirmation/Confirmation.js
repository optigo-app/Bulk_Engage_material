import React, { useState, useEffect } from 'react';
import { CallApi } from '../../API/CallApi/CallApi';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { CheckCircle2, AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';
import { refreshSessionData } from '../../Utils/refreshSessionData';
import { removeMaster } from '../../Utils/masterStore';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import './Confirmation.scss';

const Confirmation = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    actions.setStep(7);
  }, []);

  const handleConfirm = () => {
    setShowDialog(true);
  };

  const handleYesEngage = async () => {
    setShowDialog(false);
    setIsProcessing(true);

    try {
      const reportData = (() => {
        try { return JSON.parse(sessionStorage.getItem('reportVarible') || '{}'); }
        catch { return {}; }
      })();
      const appuserid = reportData?.LUId || '';
      const clientIP = sessionStorage.getItem('clientIpAddress') || '';
      const eid = String(
        state.employee?.id ?? state.employee?.eid ?? state.employee?.empid ?? ''
      );

      // Map serialjobno -> jid, so lines that never carried a jid of
      // their own (e.g. "Other Bag" / unmatched-material entries added
      // when no material data matched a scanned job) can still be
      // tied back to the correct job.
      const jobJidMap = {};
      (state.scannedJobs || []).forEach((j) => {
        const key = String(j.serialjobno ?? j.id ?? '').trim().toUpperCase();
        if (key) jobJidMap[key] = j.jid ?? null;
      });

      const rows = [];

      const entries = state.jobEntries || {};
      const hasPerJob = Object.keys(entries).some((k) => k !== 'bulk-material');

      if (hasPerJob) {
        // Single-entry mode: read per-job keys
        Object.entries(entries).forEach(([jobKey, jobData]) => {
          if (jobKey === 'bulk-material') return;
          const normalizedJobKey = String(jobKey ?? '').trim().toUpperCase();
          const fallbackJid = jobJidMap[normalizedJobKey];
          (jobData.bags || []).forEach((bag) => {
            rows.push({
              jid: String(bag.jid ?? fallbackJid ?? ''),
              qid: bag.isUnusedBag ? '-1' : String(bag.qid ?? ''),
              eid,
              rfbag: bag.rfbag || bag.bag?.rfbag || '',
              wt: bag.wt ?? 0,
              pcs: bag.pcs ?? 0,
              // txnid preserved: 0 for a fresh engagement, the original
              // engaged txnid when this row came from JobVerification's
              // "Return" (edit) flow — engagesave updates that same
              // engagement in place, so no separate return call is needed.
              txnid: bag.txnid ?? 0,
              is_sol_gem: bag.is_sol_gem ?? 0,
              stone_uniqueno: bag.stone_uniqueno ?? '',
            });
          });
        });
      } else {
        // Bulk-material mode: read from 'bulk-material' only
        (entries['bulk-material']?.bags || []).forEach((bag) => {
          rows.push({
            jid: String(bag.jid ?? ''),
            qid: bag.isUnusedBag ? '-1' : String(bag.qid ?? ''),
            eid,
            rfbag: bag.rfbag || bag.bag?.rfbag || '',
            wt: bag.wt ?? 0,
            pcs: bag.pcs ?? 0,
            txnid: bag.txnid ?? 0,
            is_sol_gem: bag.is_sol_gem ?? 0,
            stone_uniqueno: bag.stone_uniqueno ?? '',
          });
        });
      }

      const filteredRows = rows.filter((r) => r.wt > 0 || r.pcs > 0);

      const apiBody = {
        con: JSON.stringify({
          id: '',
          mode: 'engagesave',
          appuserid,
          IPAddress: clientIP,
        }),
        p: JSON.stringify({ data: filteredRows }),
        f: 'DynamicReport ( get sp list )',
      };

      await CallApi(apiBody);
    } catch (err) {
      console.error('Engage save error:', err);
    }
    sessionStorage.removeItem("scannedBagData");
    sessionStorage.removeItem("scannedJobListData");
    sessionStorage.removeItem("scannedJobMaterialData");
    setIsProcessing(false);
    setIsSuccess(true);
    actions.setComplete(true);
  };

  const handleNewProcess = async () => {
    ['allJobListData', 'allBagListData', 'allEmployeeLockerData', 'allJobMaterialData', 'allEngagedMaterial'].forEach(
      (k) => removeMaster(k),
    );
    sessionStorage.removeItem("scannedBagData");
    sessionStorage.removeItem("scannedJobListData");
    sessionStorage.removeItem("scannedJobMaterialData");
    setIsProcessing(true);
    try {
      await refreshSessionData(setIsProcessing);
    } catch (err) {
      console.error('Session refresh error:', err);
    }
    setIsProcessing(false);
    actions.reset();
    navigate('/');
  };

  if (isSuccess) {
    return (
      <div className="confirmation page-enter">
        <div className="confirmation__success-screen">
          <div className="confirmation__success-bg">
            <div className="confirmation__confetti confirmation__confetti--1" />
            <div className="confirmation__confetti confirmation__confetti--2" />
            <div className="confirmation__confetti confirmation__confetti--3" />
            <div className="confirmation__confetti confirmation__confetti--4" />
            <div className="confirmation__confetti confirmation__confetti--5" />
            <div className="confirmation__confetti confirmation__confetti--6" />
          </div>
          <div className="confirmation__success-card">
            <div className="confirmation__success-icon">
              <CheckCircle2 size={64} />
            </div>
            <h1>Engage Successful!</h1>
            <p>All materials have been successfully engaged and processed.</p>
            <div className="confirmation__success-details">
              <div className="confirmation__success-detail">
                <span>Employee</span>
                <strong>{state.employee?.name}</strong>
              </div>
              <div className="confirmation__success-detail">
                <span>Locker</span>
                <strong>{state.locker?.name}</strong>
              </div>
              <div className="confirmation__success-detail">
                <span>Jobs Processed</span>
                <strong>{state.scannedJobs.length}</strong>
              </div>
              <div className="confirmation__success-detail">
                <span>Bags Scanned</span>
                <strong>{state.scannedBags.length}</strong>
              </div>
            </div>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleNewProcess}
              startIcon={<RotateCcw size={18} />}
              className="confirmation__new-btn"
            >
              Start New Process
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="confirmation page-enter">
        <div className="confirmation__processing-screen">
          <div className="confirmation__processing-card">
            <div className="confirmation__processing-spinner">
              <div className="confirmation__spinner-ring" />
              <div className="confirmation__spinner-ring confirmation__spinner-ring--2" />
              <div className="confirmation__spinner-ring confirmation__spinner-ring--3" />
            </div>
            <h2>Processing Engage...</h2>
            <p>Verifying and engaging all materials. Please wait.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmation page-enter">
      <div className="confirmation__header">
        <div className="confirmation__step-badge">Final Step</div>
        <h1 className="confirmation__title">Confirmation</h1>
        <p className="confirmation__desc">Review and confirm to complete the engage process</p>
      </div>

      <div className="confirmation__review-card">
        <div className="confirmation__review-icon">
          <AlertTriangle size={32} />
        </div>
        <div className="confirmation__review-content">
          <h3>Ready to Engage?</h3>
          <p>You are about to engage <strong>{state.scannedJobs.length} jobs</strong>
            for employee <strong>{state.employee?.name}</strong> in <strong>{state.locker?.name}</strong>.</p>
          <p className="confirmation__review-warning">This action cannot be undone. Please verify all details before proceeding.</p>
        </div>
      </div>

      <div className="confirmation__summary-grid">
        <div className="confirmation__summary-item">
          <span className="confirmation__summary-label">Process Type</span>
          <span className="confirmation__summary-value">
            {state.processSubType?.replace('-', ' → ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
        <div className="confirmation__summary-item">
          <span className="confirmation__summary-label">Material</span>
          <span className="confirmation__summary-value">
            {state.materialType?.charAt(0).toUpperCase() + state.materialType?.slice(1)}
          </span>
        </div>
        <div className="confirmation__summary-item">
          <span className="confirmation__summary-label">Total Jobs</span>
          <span className="confirmation__summary-value">{state.scannedJobs.length}</span>
        </div>
      </div>

      <div className="confirmation__actions">
        <Button
          variant="outlined"
          onClick={() => navigate('/summary')}
          startIcon={<ArrowLeft size={18} />}
          className="confirmation__back-btn"
        >
          Back to Summary
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleConfirm}
          className="confirmation__engage-btn"
        >
          Save & Process
        </Button>
      </div>

      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: '#1a2744',
            border: '1px solid #2a3f5f',
            borderRadius: '16px',
            color: '#fff',
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 4, fontWeight: 700, fontSize: 20 }}>
          Confirm Engagement
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <div className="confirmation__dialog-icon">
            <AlertTriangle size={48} />
          </div>
          <p style={{ color: '#94a3b8', marginTop: 16 }}>
            Are you sure you want to engage all scanned materials? This action will finalize the process.
          </p>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 4, gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowDialog(false)}
            sx={{
              color: '#94a3b8',
              borderColor: '#2a3f5f',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              height: 44,
              '&:hover': { borderColor: '#94a3b8' }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleYesEngage}
            sx={{
              background: 'linear-gradient(135deg, #2e7d32, #4caf50)',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              height: 44,
              fontSize: 15,
              '&:hover': { background: 'linear-gradient(135deg, #388e3c, #66bb6a)' }
            }}
          >
            Yes, Engage!
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Confirmation;

// import React, { useState, useEffect } from 'react';
// import { CallApi } from '../../API/CallApi/CallApi';
// import { useNavigate } from 'react-router-dom';
// import { useEngage } from '../../context/EngageContext';
// import { CheckCircle2, AlertTriangle, RotateCcw, ArrowLeft, RefreshCw } from 'lucide-react';
// import { refreshSessionData } from '../../Utils/refreshSessionData';
// import { removeMaster } from '../../Utils/masterStore';
// import Button from '@mui/material/Button';
// import Dialog from '@mui/material/Dialog';
// import DialogTitle from '@mui/material/DialogTitle';
// import DialogContent from '@mui/material/DialogContent';
// import DialogActions from '@mui/material/DialogActions';
// import './Confirmation.scss';

// const Confirmation = () => {
//   const navigate = useNavigate();
//   const { state, actions } = useEngage();
//   console.log('state: ', state);
//   const [showDialog, setShowDialog] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [isSuccess, setIsSuccess] = useState(false);

//   useEffect(() => {
//     actions.setStep(7);
//   }, []);

//   const handleConfirm = () => {
//     setShowDialog(true);
//   };

//   const handleYesEngage = async () => {
//     setShowDialog(false);
//     setIsProcessing(true);

//     try {
//       const reportData = (() => {
//         try { return JSON.parse(sessionStorage.getItem('reportVarible') || '{}'); }
//         catch { return {}; }
//       })();
//       const appuserid = reportData?.LUId || '';
//       const clientIP = sessionStorage.getItem('clientIpAddress') || '';
//       const eid = String(
//         state.employee?.id ?? state.employee?.eid ?? state.employee?.empid ?? ''
//       );

//       // Map serialjobno -> jid, so lines that never carried a jid of
//       // their own (e.g. "Other Bag" / unmatched-material entries added
//       // when no material data matched a scanned job) can still be
//       // tied back to the correct job.
//       const jobJidMap = {};
//       (state.scannedJobs || []).forEach((j) => {
//         const key = String(j.serialjobno ?? j.id ?? '').trim().toUpperCase();
//         if (key) jobJidMap[key] = j.jid ?? null;
//       });

//       const rows = [];

//       const entries = state.jobEntries || {};
//       const hasPerJob = Object.keys(entries).some((k) => k !== 'bulk-material');

//       if (hasPerJob) {
//         // Single-entry mode: read per-job keys
//         Object.entries(entries).forEach(([jobKey, jobData]) => {
//           if (jobKey === 'bulk-material') return;
//           const normalizedJobKey = String(jobKey ?? '').trim().toUpperCase();
//           const fallbackJid = jobJidMap[normalizedJobKey];
//           (jobData.bags || []).forEach((bag) => {
//             rows.push({
//               jid: String(bag.jid ?? fallbackJid ?? ''),
//               qid: bag.isUnusedBag ? '-1' : String(bag.qid ?? ''),
//               eid,
//               rfbag: bag.rfbag || bag.bag?.rfbag || '',
//               wt: bag.wt ?? 0,
//               pcs: bag.pcs ?? 0,
//               txnid: bag.txnid ?? 0,
//             });
//           });
//         });
//       } else {
//         // Bulk-material mode: read from 'bulk-material' only
//         (entries['bulk-material']?.bags || []).forEach((bag) => {
//           rows.push({
//             jid: String(bag.jid ?? ''),
//             qid: bag.isUnusedBag ? '-1' : String(bag.qid ?? ''),
//             eid,
//             rfbag: bag.rfbag || bag.bag?.rfbag || '',
//             wt: bag.wt ?? 0,
//             pcs: bag.pcs ?? 0,
//             txnid: bag.txnid ?? 0,
//           });
//         });
//       }

//       const filteredRows = rows.filter((r) => r.wt > 0 || r.pcs > 0);

//       const apiBody = {
//         con: JSON.stringify({
//           id: '',
//           mode: 'engagesave',
//           appuserid,
//           IPAddress: clientIP,
//         }),
//         p: JSON.stringify({ data: filteredRows }),
//         f: 'DynamicReport ( get sp list )',
//       };

//       await CallApi(apiBody);
//     } catch (err) {
//       console.error('Engage save error:', err);
//     }
//     sessionStorage.removeItem("scannedBagData");
//     sessionStorage.removeItem("scannedJobListData");
//     sessionStorage.removeItem("scannedJobMaterialData");
//     setIsProcessing(false);
//     setIsSuccess(true);
//     actions.setComplete(true);
//   };

//   // const handleYesEngage = async () => {
//   //   setShowDialog(false);
//   //   setIsProcessing(true);

//   //   try {
//   //     const reportData = (() => {
//   //       try { return JSON.parse(sessionStorage.getItem('reportVarible') || '{}'); }
//   //       catch { return {}; }
//   //     })();
//   //     const appuserid = reportData?.LUId || '';
//   //     const clientIP = sessionStorage.getItem('clientIpAddress') || '';
//   //     const eid = String(
//   //       state.employee?.id ?? state.employee?.eid ?? state.employee?.empid ?? ''
//   //     );
//   //     const rows = [];
//   //     Object.entries(state.jobEntries || {}).forEach(([, jobData]) => {
//   //       (jobData.bags || []).forEach((bag) => {
//   //         rows.push({
//   //           jid: String(bag.jid ?? ''),
//   //           qid: bag.isUnusedBag ? '-1' : String(bag.qid ?? ''),
//   //           eid,
//   //           rfbag: bag.rfbag || bag.bag?.rfbag || '',
//   //           wt: bag.wt ?? 0,
//   //           pcs: bag.pcs ?? 0,
//   //           txnid: bag.txnid ?? 0,
//   //         });
//   //       });
//   //     });

//   //     const filteredRows = rows.filter((r) => r.wt > 0 || r.pcs > 0);

//   //     const apiBody = {
//   //       con: JSON.stringify({
//   //         id: '',
//   //         mode: 'engagesave',
//   //         appuserid,
//   //         IPAddress: clientIP,
//   //       }),
//   //       p: JSON.stringify({ data: filteredRows }),
//   //       f: 'DynamicReport ( get sp list )',
//   //     };

//   //     await CallApi(apiBody);
//   //   } catch (err) {
//   //     console.error('Engage save error:', err);
//   //   }
//   //   sessionStorage.removeItem("scannedBagData");
//   //   sessionStorage.removeItem("scannedJobListData");
//   //   sessionStorage.removeItem("scannedJobMaterialData");
//   //   setIsProcessing(false);
//   //   setIsSuccess(true);
//   //   actions.setComplete(true);
//   // };

  
//   const handleNewProcess = async () => {
//     ['allJobListData', 'allBagListData', 'allEmployeeLockerData', 'allJobMaterialData', 'allEngagedMaterial'].forEach(
//       (k) => removeMaster(k),
//     );
//     sessionStorage.removeItem("scannedBagData");
//     sessionStorage.removeItem("scannedJobListData");
//     sessionStorage.removeItem("scannedJobMaterialData");
//     setIsProcessing(true);
//     try {
//       await refreshSessionData(setIsProcessing);
//     } catch (err) {
//       console.error('Session refresh error:', err);
//     }
//     setIsProcessing(false);
//     actions.reset();
//     navigate('/');
//   };

//   if (isSuccess) {
//     return (
//       <div className="confirmation page-enter">
//         <div className="confirmation__success-screen">
//           <div className="confirmation__success-bg">
//             <div className="confirmation__confetti confirmation__confetti--1" />
//             <div className="confirmation__confetti confirmation__confetti--2" />
//             <div className="confirmation__confetti confirmation__confetti--3" />
//             <div className="confirmation__confetti confirmation__confetti--4" />
//             <div className="confirmation__confetti confirmation__confetti--5" />
//             <div className="confirmation__confetti confirmation__confetti--6" />
//           </div>
//           <div className="confirmation__success-card">
//             <div className="confirmation__success-icon">
//               <CheckCircle2 size={64} />
//             </div>
//             <h1>Engage Successful!</h1>
//             <p>All materials have been successfully engaged and processed.</p>
//             <div className="confirmation__success-details">
//               <div className="confirmation__success-detail">
//                 <span>Employee</span>
//                 <strong>{state.employee?.name}</strong>
//               </div>
//               <div className="confirmation__success-detail">
//                 <span>Locker</span>
//                 <strong>{state.locker?.name}</strong>
//               </div>
//               <div className="confirmation__success-detail">
//                 <span>Jobs Processed</span>
//                 <strong>{state.scannedJobs.length}</strong>
//               </div>
//               <div className="confirmation__success-detail">
//                 <span>Bags Scanned</span>
//                 <strong>{state.scannedBags.length}</strong>
//               </div>
//             </div>
//             <Button
//               variant="contained"
//               color="primary"
//               size="large"
//               onClick={handleNewProcess}
//               startIcon={<RotateCcw size={18} />}
//               className="confirmation__new-btn"
//             >
//               Start New Process
//             </Button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   if (isProcessing) {
//     return (
//       <div className="confirmation page-enter">
//         <div className="confirmation__processing-screen">
//           <div className="confirmation__processing-card">
//             <div className="confirmation__processing-spinner">
//               <div className="confirmation__spinner-ring" />
//               <div className="confirmation__spinner-ring confirmation__spinner-ring--2" />
//               <div className="confirmation__spinner-ring confirmation__spinner-ring--3" />
//             </div>
//             <h2>Processing Engage...</h2>
//             <p>Verifying and engaging all materials. Please wait.</p>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="confirmation page-enter">
//       <div className="confirmation__header">
//         <div className="confirmation__step-badge">Final Step</div>
//         <h1 className="confirmation__title">Confirmation</h1>
//         <p className="confirmation__desc">Review and confirm to complete the engage process</p>
//       </div>

//       <div className="confirmation__review-card">
//         <div className="confirmation__review-icon">
//           <AlertTriangle size={32} />
//         </div>
//         <div className="confirmation__review-content">
//           <h3>Ready to Engage?</h3>
//           <p>You are about to engage <strong>{state.scannedJobs.length} jobs {" "}
//             {/* </strong> with <strong>{state.scannedBags.length} bags */}
//           </strong>
//             for employee <strong>{state.employee?.name}</strong> in <strong>{state.locker?.name}</strong>.</p>
//           <p className="confirmation__review-warning">This action cannot be undone. Please verify all details before proceeding.</p>
//         </div>
//       </div>

//       <div className="confirmation__summary-grid">
//         <div className="confirmation__summary-item">
//           <span className="confirmation__summary-label">Process Type</span>
//           <span className="confirmation__summary-value">
//             {state.processSubType?.replace('-', ' → ').replace(/\b\w/g, l => l.toUpperCase())}
//           </span>
//         </div>
//         <div className="confirmation__summary-item">
//           <span className="confirmation__summary-label">Material</span>
//           <span className="confirmation__summary-value">
//             {state.materialType?.charAt(0).toUpperCase() + state.materialType?.slice(1)}
//           </span>
//         </div>
//         <div className="confirmation__summary-item">
//           <span className="confirmation__summary-label">Total Jobs</span>
//           <span className="confirmation__summary-value">{state.scannedJobs.length}</span>
//         </div>
//         {/* <div className="confirmation__summary-item">
//           <span className="confirmation__summary-label">Total Bags</span>
//           <span className="confirmation__summary-value">{state.scannedBags.length}</span>
//         </div> */}
//       </div>

//       <div className="confirmation__actions">
//         <Button
//           variant="outlined"
//           onClick={() => navigate('/summary')}
//           startIcon={<ArrowLeft size={18} />}
//           className="confirmation__back-btn"
//         >
//           Back to Summary
//         </Button>
//         <Button
//           variant="contained"
//           color="primary"
//           size="large"
//           onClick={handleConfirm}
//           className="confirmation__engage-btn"
//         >
//           Save & Process
//         </Button>
//       </div>

//       <Dialog
//         open={showDialog}
//         onClose={() => setShowDialog(false)}
//         maxWidth="sm"
//         fullWidth
//         PaperProps={{
//           sx: {
//             background: '#1a2744',
//             border: '1px solid #2a3f5f',
//             borderRadius: '16px',
//             color: '#fff',
//           }
//         }}
//       >
//         <DialogTitle sx={{ textAlign: 'center', pt: 4, fontWeight: 700, fontSize: 20 }}>
//           Confirm Engagement
//         </DialogTitle>
//         <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
//           <div className="confirmation__dialog-icon">
//             <AlertTriangle size={48} />
//           </div>
//           <p style={{ color: '#94a3b8', marginTop: 16 }}>
//             Are you sure you want to engage all scanned materials? This action will finalize the process.
//           </p>
//         </DialogContent>
//         <DialogActions sx={{ justifyContent: 'center', pb: 4, gap: 2 }}>
//           <Button
//             variant="outlined"
//             onClick={() => setShowDialog(false)}
//             sx={{
//               color: '#94a3b8',
//               borderColor: '#2a3f5f',
//               borderRadius: '10px',
//               textTransform: 'none',
//               fontWeight: 600,
//               px: 4,
//               height: 44,
//               '&:hover': { borderColor: '#94a3b8' }
//             }}
//           >
//             Cancel
//           </Button>
//           <Button
//             variant="contained"
//             onClick={handleYesEngage}
//             sx={{
//               background: 'linear-gradient(135deg, #2e7d32, #4caf50)',
//               borderRadius: '10px',
//               textTransform: 'none',
//               fontWeight: 700,
//               px: 4,
//               height: 44,
//               fontSize: 15,
//               '&:hover': { background: 'linear-gradient(135deg, #388e3c, #66bb6a)' }
//             }}
//           >
//             Yes, Engage!
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </div>
//   );
// };

// export default Confirmation;