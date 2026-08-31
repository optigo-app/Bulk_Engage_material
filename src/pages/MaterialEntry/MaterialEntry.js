import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import {
  ArrowLeft, ArrowRight, Save, Package, Gem, Palette, Wrench,
  ScanLine, CheckCircle2, Plus, PackageOpen
} from 'lucide-react';
import Button from '@mui/material/Button';
import './MaterialEntry.scss';
import BulkSingleEntry from './BulkSingleEntry/BulkSingleEntry';
import BulkMaterialWise from './BulkMaterialWise/BulkMaterialWise';
import SingleSingleEntry from './SingleSingleEntry/SingleSingleEntry';
import SingleBulkEntry from './SingleBulkEntry/SingleBulkEntry';

const MaterialEntry = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [onContinue, setOnContinue] = useState(null);
  useEffect(() => {
    actions.setStep(6);
  }, []);

  const subTypeLabel =
    state.processSubType == 'single-single' ?
      'single-single'
      : state.processSubType === 'single-bulk' ?
        "single-bulk"
        : state.processSubType === 'bulk-single' ?
          "bulk-job"
          :
          "bulk-material";

  return (
    <div className="material-entry page-enter">
      <div className="material-entry__header">
        <div className="material-entry__step-badge">Step 6</div>
        <div className="material-entry__mode-badge">{subTypeLabel}</div>
      </div>

      {state.processSubType === 'single-single' ? (
        <SingleSingleEntry state={state} actions={actions} />
      ) : state.processSubType === 'single-bulk' ? (
        <SingleBulkEntry state={state} actions={actions} />
      ) : state.processSubType === 'bulk-single' ? (
        <BulkSingleEntry state={state} actions={actions} onRegisterContinue={setOnContinue}/>
      ) :
        <BulkMaterialWise state={state} actions={actions} onRegisterContinue={setOnContinue} />
      }

      <div className="material-entry__actions">
        <Button
          variant="outlined"
          onClick={() => navigate('/bag-scanning')}
          startIcon={<ArrowLeft size={18} />}
          className="material-entry__back-btn"
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => { onContinue?.(); navigate('/summary'); }}
          endIcon={<ArrowRight size={20} />}
          className="material-entry__continue-btn"
        >
          Continue to Summary
        </Button>
      </div>
    </div>
  );
};

export default MaterialEntry;