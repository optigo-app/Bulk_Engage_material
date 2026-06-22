import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { ArrowRight, ArrowLeft, Layers, Gem, Palette, Wrench, Package } from 'lucide-react';
import Button from '@mui/material/Button';
import './SelectProcess.scss';

const SelectProcess = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [step, setStep] = useState(1);

  useEffect(() => {
    actions.setStep(3);
    if (!state.locker) navigate('/select-locker');
  }, []);

  const handleProcessType = (type) => {
    actions.setProcessType(type);
    setStep(2);
  };

  const handleSubType = (subType) => {
    actions.setProcessSubType(subType);
    setStep(3);
  };

  const handleMaterial = (material) => {
    actions.setMaterialType(material);
    navigate('/scan-jobs');
  };

  const handleBackStep = () => {
    if (step === 3) {
      actions.setMaterialType(null);
      setStep(2);
    } else if (step === 2) {
      actions.setProcessType(null);
      actions.setProcessSubType(null);
      setStep(1);
    } else {
      if (state.employee?.code == "E002") {
        navigate('/');
      } else {
        navigate('/select-locker');
      }
    }
  };

  return (
    <div className="select-process page-enter">
      <div className="select-process__header">
        <div className="select-process__step-badge">Step 3</div>
        <h1 className="select-process__title">Select Process</h1>
        <p className="select-process__desc">Choose the engage method and material type</p>
      </div>

      <div className="select-process__progress">
        <div className={`select-process__progress-dot ${step >= 1 ? 'select-process__progress-dot--active' : ''}`}>
          <span>1</span>
          <label>Type</label>
        </div>
        <div className={`select-process__progress-line ${step >= 2 ? 'select-process__progress-line--active' : ''}`} />
        <div className={`select-process__progress-dot ${step >= 2 ? 'select-process__progress-dot--active' : ''}`}>
          <span>2</span>
          <label>Sub-Type</label>
        </div>
        <div className={`select-process__progress-line ${step >= 3 ? 'select-process__progress-line--active' : ''}`} />
        <div className={`select-process__progress-dot ${step >= 3 ? 'select-process__progress-dot--active' : ''}`}>
          <span>3</span>
          <label>Material</label>
        </div>
      </div>

      {step === 1 && (
        <div className="select-process__section page-enter">
          <h2 className="select-process__section-title">Select Engage Type</h2>
          <div className="select-process__type-grid">
            <div
              className={`select-process__type-card ${state.processType === 'single' ? 'select-process__type-card--selected' : ''}`}
              onClick={() => handleProcessType('single')}
            >
              <div className="select-process__type-icon select-process__type-icon--single">
                <Layers size={32} />
              </div>
              <h3>Single Engage</h3>
              <p>Process one job at a time with individual material assignment</p>
              <div className="select-process__type-tag">A</div>
            </div>
            <div
              className={`select-process__type-card ${state.processType === 'bulk' ? 'select-process__type-card--selected' : ''}`}
              onClick={() => handleProcessType('bulk')}
            >
              <div className="select-process__type-icon select-process__type-icon--bulk">
                <Package size={32} />
              </div>
              <h3>Bulk Engage</h3>
              <p>Process multiple jobs together in bulk operation</p>
              <div className="select-process__type-tag">B</div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="select-process__section page-enter">
          <h2 className="select-process__section-title">
            Select Sub-Type for {state.processType === 'single' ? 'Single' : 'Bulk'} Engage
          </h2>
          <div className="select-process__type-grid">
            {state.processType === 'single' ? (
              <>
                <div
                  className={`select-process__type-card ${state.processSubType === 'single-single' ? 'select-process__type-card--selected' : ''}`}
                  onClick={() => handleSubType('single-single')}
                >
                  <div className="select-process__type-icon select-process__type-icon--a1">
                    <span className="select-process__type-label-big">A1</span>
                  </div>
                  <h3>Single → Single</h3>
                  <p>One job with one material at a time</p>
                </div>
                <div
                  className={`select-process__type-card ${state.processSubType === 'single-bulk' ? 'select-process__type-card--selected' : ''}`}
                  onClick={() => handleSubType('single-bulk')}
                >
                  <div className="select-process__type-icon select-process__type-icon--a2">
                    <span className="select-process__type-label-big">A2</span>
                  </div>
                  <h3>Single → Bulk</h3>
                  <p>One job with multiple materials</p>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`select-process__type-card ${state.processSubType === 'bulk-single' ? 'select-process__type-card--selected' : ''}`}
                  onClick={() => handleSubType('bulk-single')}
                >
                  <div className="select-process__type-icon select-process__type-icon--b1">
                    <span className="select-process__type-label-big">B1</span>
                  </div>
                  <h3>Bulk → Single</h3>
                  <p>Multiple jobs with single material each</p>
                </div>
                <div
                  className={`select-process__type-card ${state.processSubType === 'bulk-bulk' ? 'select-process__type-card--selected' : ''}`}
                  onClick={() => handleSubType('bulk-bulk')}
                >
                  <div className="select-process__type-icon select-process__type-icon--b2">
                    <span className="select-process__type-label-big">B2</span>
                  </div>
                  <h3>Bulk → Bulk RM</h3>
                  <p>Multiple jobs with bulk raw material</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="select-process__section page-enter">
          <h2 className="select-process__section-title">Select Material Type</h2>
          <div className="select-process__material-grid">
            {[
              { id: 'all', label: 'All', icon: Package, color: '#1565c0' },
              { id: 'diamond', label: 'Diamond', icon: Gem, color: '#e91e63' },
              { id: 'colorstone', label: 'Colorstone', icon: Palette, color: '#9c27b0' },
              { id: 'misc', label: 'Misc / Findings', icon: Wrench, color: '#ff9800' },
            ].map((mat) => {
              const Icon = mat.icon;
              return (
                <div
                  key={mat.id}
                  className={`select-process__material-card ${state.materialType === mat.id ? 'select-process__material-card--selected' : ''}`}
                  onClick={() => handleMaterial(mat.id)}
                  style={{ '--mat-color': mat.color }}
                >
                  <div className="select-process__material-icon">
                    <Icon size={28} />
                  </div>
                  <span className="select-process__material-label">{mat.label}</span>
                  {state.materialType === mat.id && (
                    <div className="select-process__material-check">✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="select-process__actions">
        <Button
          variant="outlined"
          onClick={handleBackStep}
          startIcon={<ArrowLeft size={18} />}
          className="select-process__back-btn"
        >
          Back
        </Button>
        {/* {step === 3 && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleContinue}
            disabled={!state.materialType}
            endIcon={<ArrowRight size={20} />}
            className="select-process__continue-btn"
          >
            Continue to Scan Jobs
          </Button>
        )} */}
      </div>
    </div>
  );
};

export default SelectProcess;