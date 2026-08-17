import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { Lock, ArrowRight, ArrowLeft, ScanLine } from 'lucide-react';
import Button from '@mui/material/Button';
import './SelectLocker.scss';
import { getMaster } from '../../Utils/masterStore';

const getLockerData = () => {
  try {
    const apiData = getMaster('allLockerData', []);
    return apiData.map((l) => ({
      id: l.lid ?? l.id ?? l.lockerno,
      name: l.Lockername,
    }));
  } catch {
    return [];
  }
};

const getAllEmployeeLockerRights = () => getMaster('allEmployeeLockerData', []);

const SelectLocker = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [lockers, setLockers] = useState([]);
  const [scanMsg, setScanMsg] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(0);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef(null);
  const gridRef = useRef(null);
  const continueRef = useRef(null);

  // ── Load lockers ──
  useEffect(() => {
    actions.setStep(2);
    if (!state.employee) navigate('/');

    const allLockers = getLockerData();
    const allRights = getAllEmployeeLockerRights();
    const employeeId = state.employee?.id;
    const employeeRights = allRights.filter((r) => r.empid === employeeId);

    const lockerRightsMap = {};
    employeeRights.forEach((r) => {
      lockerRightsMap[r.Lockerid] = r.IsWrite === 1;
    });

    const allowedLockerIds = new Set(Object.keys(lockerRightsMap).map(Number));

    const filteredLockers = allLockers
      .filter((l) => allowedLockerIds.has(l.id))
      .map((l) => ({ ...l, canWrite: lockerRightsMap[l.id] === true }));

    setLockers(filteredLockers);
  }, []); // eslint-disable-line

  // ── Focus continue button when locker selected ──
  useEffect(() => {
    if (state.locker) {
      setTimeout(() => continueRef.current?.focus(), 100);
    }
  }, [state.locker]);

  // ── Auto-scroll focused card into view ──
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll('.select-locker__card');
    if (cards && cards[focusedIdx]) {
      cards[focusedIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIdx]);

  // ── Keyboard navigation ──
  useEffect(() => {
    const cols = 4;
    const total = lockers.length;

    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // If Continue button is focused, only handle Enter and Escape
      if (document.activeElement === continueRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleContinue();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          continueRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIdx(prev => Math.min(prev + 1, total - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIdx(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIdx(prev => Math.min(prev + cols, total - 1));
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
            setFocusedIdx(prev => Math.min(prev + 1, total - 1));
          }
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const locker = lockers[focusedIdx];
          if (!locker) return;
          if (locker.canWrite) {
            handleSelect(locker);
            // After selecting, move focus to Continue button
            setTimeout(() => continueRef.current?.focus(), 100);
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          navigate('/');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lockers, focusedIdx, state.locker]); // eslint-disable-line

  // ── Barcode scanner listener ──
  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        const val = bufferRef.current.trim();
        bufferRef.current = '';
        clearTimeout(bufferTimerRef.current);
        if (val) matchLocker(val);
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => {
          const val = bufferRef.current.trim();
          bufferRef.current = '';
          if (val) matchLocker(val);
        }, 300);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(bufferTimerRef.current);
    };
  }, [lockers]); // eslint-disable-line

  const matchLocker = (val) => {
    const v = val.trim().toUpperCase();
    const found = lockers.find(
      (l) =>
        String(l.id) === v ||
        l.name.toUpperCase() === v ||
        l.name.toUpperCase().replace(/\s+/g, '') === v.replace(/\s+/g, '')
    );

    if (!found) {
      setScanMsg(`❌ No locker found for "${val}"`);
      setTimeout(() => setScanMsg(''), 2000);
      return;
    }

    if (!found.canWrite) {
      setScanMsg(`⚠️ "${found.name}" is not available or read-only`);
      setTimeout(() => setScanMsg(''), 2000);
      return;
    }

    actions.setLocker(found);
    setScanMsg(`✓ ${found.name} selected`);
    setTimeout(() => setScanMsg(''), 1500);
  };

  const handleSelect = (locker) => {
    if (locker.canWrite) {
      actions.setLocker(locker);
    }
  };

  const handleContinue = () => {
    if (state.locker) navigate('/select-process');
  };

  return (
    <div className="select-locker page-enter">
      <div className="select-locker__header">
        <div className="select-locker__step-badge">Step 2</div>
        <h1 className="select-locker__title">Select Locker</h1>
        <p className="select-locker__desc">
          Choose a locker or scan its barcode to assign for this engage process
        </p>
      </div>

      <div className="select-locker__grid" ref={gridRef}>
        {lockers.map((locker, idx) => {
          const isSelected = state.locker?.id === locker.id;
          const isDisabled = !locker.canWrite;
          const isFocused = focusedIdx === idx;

          return (
            <div
              key={locker.id}
              className={[
                'select-locker__card',
                isSelected ? 'select-locker__card--selected' : '',
                isDisabled ? 'select-locker__card--disabled' : '',
                isFocused ? 'select-locker__card--focused' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { setFocusedIdx(idx); handleSelect(locker); }}
              onMouseEnter={() => setFocusedIdx(idx)}
              onMouseLeave={() => setFocusedIdx(-1)}
            >
              <div className="select-locker__card-icon">
                <Lock size={24} />
              </div>
              <h3 className="select-locker__card-name">{locker.name}</h3>
              <span className={`select-locker__card-status select-locker__card-status--${locker.status}`}>
                {locker.status}
              </span>
              {!locker.canWrite && (
                <span className="select-locker__card-no-write">Read Only</span>
              )}
              {isSelected && <div className="select-locker__card-check">✓</div>}
            </div>
          );
        })}
      </div>

      {lockers.length === 0 && (
        <p
          className="select-locker__empty"
          style={{ height: '300px', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          No lockers assigned to this employee.
        </p>
      )}

      <div className="select-locker__actions">
        <Button
          variant="outlined"
          onClick={() => navigate('/')}
          startIcon={<ArrowLeft size={18} />}
          className="select-locker__back-btn"
        >
          Back
        </Button>
        <Button
          ref={continueRef}
          variant="contained"
          color="primary"
          size="large"
          onClick={handleContinue}
          disabled={!state.locker}
          endIcon={<ArrowRight size={20} />}
          className="select-locker__continue-btn"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleContinue();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              continueRef.current?.blur();
            }
          }}
        >
          Continue to Select Process
        </Button>
      </div>
    </div>
  );
};

export default SelectLocker;