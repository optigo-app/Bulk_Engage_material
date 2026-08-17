import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { ArrowRight, ArrowLeft, Layers, Gem, Palette, Wrench, Package, Sparkles } from 'lucide-react';
import Button from '@mui/material/Button';
import './SelectProcess.scss';

const MATERIALS = [
  { id: 'all',        label: 'All',        icon: Package, color: '#1565c0' },
  { id: 'diamond',    label: 'Diamond',    icon: Gem,     color: '#e91e63' },
  { id: 'colorstone', label: 'Colorstone', icon: Palette, color: '#9c27b0' },
  { id: 'misc',       label: 'Misc',       icon: Sparkles, color: '#ff9800' },
  { id: 'findings',   label: 'Findings',   icon: Wrench,  color: '#ff9800' },
];

const SelectProcess = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [step, setStep] = useState(1);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const gridRef = useRef(null);

  useEffect(() => {
    actions.setStep(3);
    if (!state.locker) navigate('/select-locker');
  }, []); // eslint-disable-line

  // On step change, focus the already-selected card (if any), else the first
  useEffect(() => {
    const items = getCurrentItems();
    const selectedId =
      step === 1 ? state.processType
      : step === 2 ? state.processSubType
      : step === 3 ? state.materialType
      : null;
    const idx = selectedId ? items.indexOf(selectedId) : -1;
    setFocusedIdx(idx >= 0 ? idx : 0);
  }, [step]); // eslint-disable-line

  // Scroll focused card into view
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll(
      '.select-process__type-card, .select-process__material-card'
    );
    if (cards && cards[focusedIdx]) {
      cards[focusedIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIdx]);

  const getCurrentItems = () => {
    if (step === 1) return ['single', 'bulk'];
    if (step === 2) {
      return state.processType === 'single'
        ? ['single-single', 'single-bulk']
        : ['bulk-single', 'bulk-bulk'];
    }
    if (step === 3) return MATERIALS.map(m => m.id);
    return [];
  };

  // Keyboard navigation
  useEffect(() => {
    const items = getCurrentItems();
    const cols = step === 3 ? 5 : 2;

    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIdx(prev => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIdx(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIdx(prev => Math.min(prev + cols, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIdx(prev => Math.max(prev - cols, 0));
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setFocusedIdx(prev => Math.max(prev - 1, 0));
          } else {
            setFocusedIdx(prev => Math.min(prev + 1, items.length - 1));
          }
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const selected = items[focusedIdx];
          if (!selected) return;
          if (step === 1) handleProcessType(selected);
          else if (step === 2) handleSubType(selected);
          else if (step === 3) handleMaterial(selected);
          break;
        }
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          handleBackStep();
          break;
        default:
          if (step === 1) {
            if (e.key === 'a' || e.key === 'A') handleProcessType('single');
            if (e.key === 'b' || e.key === 'B') handleProcessType('bulk');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [step, focusedIdx, state.processType]); // eslint-disable-line

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

  // Step 1 cards data
  const step1Cards = [
    {
      id: 'single',
      label: 'Single Engage',
      desc: 'Process one job at a time with individual material assignment',
      tag: 'A',
      iconType: 'single',
      Icon: Layers,
    },
    {
      id: 'bulk',
      label: 'Bulk Engage',
      desc: 'Process multiple jobs together in bulk operation',
      tag: 'B',
      iconType: 'bulk',
      Icon: Package,
    },
  ];

  // Step 2 cards data
  const step2Cards = state.processType === 'single'
    ? [
        { id: 'single-single', label: 'Single → Single', desc: 'One job with one material at a time',    tag: 'A1', iconType: 'a1' },
        { id: 'single-bulk',   label: 'Single → Bulk',   desc: 'One job with multiple materials',        tag: 'A2', iconType: 'a2' },
      ]
    : [
        { id: 'bulk-single', label: 'Bulk → Single',  desc: 'Multiple jobs with single material each', tag: 'B1', iconType: 'b1' },
        { id: 'bulk-bulk',   label: 'Bulk → Bulk RM', desc: 'Multiple jobs with bulk raw material',    tag: 'B2', iconType: 'b2' },
      ];

  return (
    <div className="select-process page-enter">

      {/* Header */}
      <div className="select-process__header">
        <div className="select-process__step-badge">Step 3</div>
        <h1 className="select-process__title">Select Process</h1>
        <p className="select-process__desc">Choose the engage method and material type</p>
      </div>

      {/* Progress */}
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

      {/* Step 1 */}
      {step === 1 && (
        <div className="select-process__section page-enter">
          <h2 className="select-process__section-title">Select Engage Type</h2>
          <div className="select-process__type-grid" ref={gridRef}>
            {step1Cards.map((card, idx) => (
              <div
                key={card.id}
                className={[
                  'select-process__type-card',
                  state.processType === card.id ? 'select-process__type-card--selected' : '',
                  focusedIdx === idx       ? 'select-process__type-card--focused'   : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleProcessType(card.id)}
                onMouseEnter={() => setFocusedIdx(idx)}
                onMouseLeave={() => setFocusedIdx(-1)}
              >
                <div className={`select-process__type-icon select-process__type-icon--${card.iconType}`}>
                  <card.Icon size={32} />
                </div>
                <h3>{card.label}</h3>
                <p>{card.desc}</p>
                <div className="select-process__type-tag">{card.tag}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="select-process__section page-enter">
          <h2 className="select-process__section-title">
            Select Sub-Type for {state.processType === 'single' ? 'Single' : 'Bulk'} Engage
          </h2>
          <div className="select-process__type-grid" ref={gridRef}>
            {step2Cards.map((card, idx) => (
              <div
                key={card.id}
                className={[
                  'select-process__type-card',
                  state.processSubType === card.id ? 'select-process__type-card--selected' : '',
                  focusedIdx === idx          ? 'select-process__type-card--focused'   : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSubType(card.id)}
                onMouseEnter={() => setFocusedIdx(idx)}
                onMouseLeave={() => setFocusedIdx(-1)}
              >
                <div className={`select-process__type-icon select-process__type-icon--${card.iconType}`}>
                  <span className="select-process__type-label-big">{card.tag}</span>
                </div>
                <h3>{card.label}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="select-process__section page-enter">
          <h2 className="select-process__section-title">Select Material Type</h2>
          <div className="select-process__material-grid" ref={gridRef}>
            {MATERIALS.map((mat, idx) => {
              const Icon = mat.icon;
              return (
                <div
                  key={mat.id}
                  className={[
                    'select-process__material-card',
                    state.materialType === mat.id ? 'select-process__material-card--selected' : '',
                    focusedIdx === idx             ? 'select-process__material-card--focused'   : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleMaterial(mat.id)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                onMouseLeave={() => setFocusedIdx(-1)}
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

      {/* Actions */}
      <div className="select-process__actions">
        <Button
          variant="outlined"
          onClick={handleBackStep}
          startIcon={<ArrowLeft size={18} />}
          className="select-process__back-btn"
        >
          Back
        </Button>
      </div>

    </div>
  );
};

export default SelectProcess;