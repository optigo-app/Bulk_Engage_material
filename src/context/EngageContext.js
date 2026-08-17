import React, { createContext, useContext, useReducer } from 'react';

const EngageContext = createContext();

const initialState = {
  currentStep: 1,
  employee: null,
  locker: null,
  processType: null,       // 'single' or 'bulk'
  processSubType: null,    // 'single-single', 'single-bulk', 'bulk-single', 'bulk-bulk'
  materialType: null,      // 'all', 'diamond', 'colorstone', 'misc'
  scannedJobs: [],
  requiredBags: [],
  scannedBags: [],
  jobEntries: {},          // { jobId: { bags: [{ bagId, cwt, pcs }] } }
  otherBags: [],
  isProcessing: false,
  isComplete: false,
};

const ACTIONS = {
  SET_STEP: 'SET_STEP',
  SET_EMPLOYEE: 'SET_EMPLOYEE',
  SET_LOCKER: 'SET_LOCKER',
  SET_PROCESS_TYPE: 'SET_PROCESS_TYPE',
  SET_PROCESS_SUB_TYPE: 'SET_PROCESS_SUB_TYPE',
  SET_MATERIAL_TYPE: 'SET_MATERIAL_TYPE',
  ADD_SCANNED_JOB: 'ADD_SCANNED_JOB',
  REMOVE_SCANNED_JOB: 'REMOVE_SCANNED_JOB',
  SET_REQUIRED_BAGS: 'SET_REQUIRED_BAGS',
  ADD_SCANNED_BAG: 'ADD_SCANNED_BAG',
  REMOVE_SCANNED_BAG: 'REMOVE_SCANNED_BAG',
  UPDATE_JOB_ENTRY: 'UPDATE_JOB_ENTRY',
  SET_PROCESSING: 'SET_PROCESSING',
  SET_COMPLETE: 'SET_COMPLETE',
  RESET: 'RESET',
  RESET_BAG_AND_MATERIAL: 'RESET_BAG_AND_MATERIAL',
};



function engageReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_STEP:
      return { ...state, currentStep: action.payload };
    case ACTIONS.SET_EMPLOYEE:
      return { ...state, employee: action.payload };
    case ACTIONS.SET_LOCKER:
      return { ...state, locker: action.payload };
    case ACTIONS.SET_PROCESS_TYPE:
      return { ...state, processType: action.payload, processSubType: null };
    case ACTIONS.SET_PROCESS_SUB_TYPE:
      return { ...state, processSubType: action.payload };
    case ACTIONS.SET_MATERIAL_TYPE:
      return { ...state, materialType: action.payload };
    case ACTIONS.ADD_SCANNED_JOB:
      if (state.scannedJobs.find(j => j.id === action.payload.id)) return state;
      return { ...state, scannedJobs: [...state.scannedJobs, action.payload] };
    case ACTIONS.REMOVE_SCANNED_JOB:
      return { ...state, scannedJobs: state.scannedJobs.filter(j => j.id !== action.payload) };
    case ACTIONS.SET_REQUIRED_BAGS:
      return { ...state, requiredBags: action.payload };
    case ACTIONS.ADD_SCANNED_BAG:
      if (state.scannedBags.find(b => b.id === action.payload.id)) return state;
      return { ...state, scannedBags: [...state.scannedBags, action.payload] };
    case ACTIONS.REMOVE_SCANNED_BAG:
      return { ...state, scannedBags: state.scannedBags.filter(b => b.id !== action.payload) };
    case ACTIONS.UPDATE_JOB_ENTRY:
      return {
        ...state,
        jobEntries: {
          ...state.jobEntries,
          [action.payload.jobId]: action.payload.data,
        },
      };
    case ACTIONS.SET_PROCESSING:
      return { ...state, isProcessing: action.payload };
    case ACTIONS.SET_COMPLETE:
      return { ...state, isComplete: action.payload };
    case ACTIONS.RESET:
      return { ...initialState };
    case ACTIONS.RESET_BAG_AND_MATERIAL:
      return { ...state, scannedBags: [], jobEntries: {} };

    case 'ADD_OTHER_BAG':
      if (state.otherBags.find((b) => b.id === action.payload.id)) return state;
      return { ...state, otherBags: [...state.otherBags, action.payload] };

    case 'CLEAR_OTHER_BAGS':
      return { ...state, otherBags: [] };

    case ACTIONS.RESET_BAG_AND_MATERIAL:
      return { ...state, scannedBags: [], jobEntries: {}, otherBags: [] };

    default:
      return state;
  }
}

export function EngageProvider({ children }) {
  const [state, dispatch] = useReducer(engageReducer, initialState);

  const actions = {
    setStep: (step) => dispatch({ type: ACTIONS.SET_STEP, payload: step }),
    setEmployee: (emp) => dispatch({ type: ACTIONS.SET_EMPLOYEE, payload: emp }),
    setLocker: (locker) => dispatch({ type: ACTIONS.SET_LOCKER, payload: locker }),
    setProcessType: (type) => dispatch({ type: ACTIONS.SET_PROCESS_TYPE, payload: type }),
    setProcessSubType: (type) => dispatch({ type: ACTIONS.SET_PROCESS_SUB_TYPE, payload: type }),
    setMaterialType: (type) => dispatch({ type: ACTIONS.SET_MATERIAL_TYPE, payload: type }),
    addScannedJob: (job) => dispatch({ type: ACTIONS.ADD_SCANNED_JOB, payload: job }),
    removeScannedJob: (id) => dispatch({ type: ACTIONS.REMOVE_SCANNED_JOB, payload: id }),
    setRequiredBags: (bags) => dispatch({ type: ACTIONS.SET_REQUIRED_BAGS, payload: bags }),
    addScannedBag: (bag) => dispatch({ type: ACTIONS.ADD_SCANNED_BAG, payload: bag }),
    removeScannedBag: (id) => dispatch({ type: ACTIONS.REMOVE_SCANNED_BAG, payload: id }),
    addOtherBag: (bag) => dispatch({ type: 'ADD_OTHER_BAG', payload: bag }),
    clearOtherBags: () => dispatch({ type: 'CLEAR_OTHER_BAGS' }),
    updateJobEntry: (jobId, data) => dispatch({ type: ACTIONS.UPDATE_JOB_ENTRY, payload: { jobId, data } }),
    setProcessing: (val) => dispatch({ type: ACTIONS.SET_PROCESSING, payload: val }),
    setComplete: (val) => dispatch({ type: ACTIONS.SET_COMPLETE, payload: val }),
    reset: () => dispatch({ type: ACTIONS.RESET }),
    resetBagAndMaterial: () => dispatch({ type: ACTIONS.RESET_BAG_AND_MATERIAL }),
  };

  return (
    <EngageContext.Provider value={{ state, actions }}>
      {children}
    </EngageContext.Provider>
  );
}

export function useEngage() {
  const context = useContext(EngageContext);
  if (!context) throw new Error('useEngage must be used within EngageProvider');
  return context;
}

export default EngageContext;
