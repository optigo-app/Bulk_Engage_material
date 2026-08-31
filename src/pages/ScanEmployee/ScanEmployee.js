import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { ScanLine, User, BadgeCheck, ArrowRight } from 'lucide-react';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import './ScanEmployee.scss';
import { useTheme } from '../../context/ThemeContext';
import { Palette, Sun, Moon, RefreshCw } from 'lucide-react';
import { refreshSessionData } from '../../Utils/refreshSessionData';
import { getMaster, removeMaster } from '../../Utils/masterStore';
import { useRecoilState } from 'recoil';
import LoadingBackdrop from '../../Utils/LoadingBackdrop';
import { isLoadingAtom } from '../../recoil/atom';

const ScanEmployee = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [scanValue, setScanValue] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef(null);
  const { currentTheme, toggleSelector } = useTheme();
  const [, setIsLoading] = useRecoilState(isLoadingAtom);
  const [foundEmployee, setFoundEmployee] = useState(state.employee || null);

  // Job Verification toggle — persisted in sessionStorage, defaults to false.
  const [jobVerification, setJobVerification] = useState(() => {
    try {
      const v = sessionStorage.getItem('jobverification');
      return v === null ? false : v === 'true';
    } catch { return false; }
  });
  const handleJobVerificationChange = (e) => {
    const val = e.target.checked;
    setJobVerification(val);
    try { sessionStorage.setItem('jobverification', String(val)); } catch { /* ignore */ }
  };


  useEffect(() => {
    actions.setStep(1);
    // if an employee is already selected (e.g. came back via "Back"), prefill it
    if (state.employee) {
      setFoundEmployee(state.employee);
      setScanValue(state.employee.bcode || '');
    } else {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global scanner listener (fires when no input is focused) ──
  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        const val = bufferRef.current.trim();
        bufferRef.current = '';
        clearTimeout(bufferTimerRef.current);
        if (val) {
          setScanValue(val);
          triggerScan(val);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => {
          const val = bufferRef.current.trim();
          bufferRef.current = '';
          if (val) {
            setScanValue(val);
            triggerScan(val);
          }
        }, 300);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(bufferTimerRef.current);
    };
  }, []); // eslint-disable-line

  const triggerScan = (val) => {
    if (!val?.trim()) {
      setError('Please scan or enter employee code');
      return;
    }
    setIsScanning(true);
    setError('');
    setFoundEmployee(null);

    setTimeout(() => {
      const allEmployees = getMaster('allEmployeeData', []);

      const emp = allEmployees.find(
        (e) => e.bcode?.toLowerCase() === val.trim().toLowerCase()
      );

      if (emp) {
        setFoundEmployee(emp);
      } else {
        setError('Employee not found. Please try again.');
      }
      setIsScanning(false);
    }, 200);
  };

  // ── Manual input handlers ──
  const handleScan = () => triggerScan(scanValue);
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleScan(); };

  const handleContinue = () => {
    if (!foundEmployee) return;
    actions.setEmployee(foundEmployee);

    let empLocker = null;
    try {
      const empLockers = getMaster('allEmployeeLockerData', []);
      empLocker = empLockers.find(
        (el) =>
          el.bcode === foundEmployee.bcode ||
          el.empcode === foundEmployee.code ||
          el.code === foundEmployee.code
      );
    } catch { empLocker = null; }

    if (empLocker) {
      const lockerData = {
        id: empLocker.lid ?? empLocker.id ?? empLocker.lockerno,
        name: empLocker.lname ?? empLocker.name ?? empLocker.lockername ?? `Locker ${empLocker.lid ?? empLocker.id}`,
        status: 'available',
        items: 0,
      };
      actions.setLocker(lockerData);
      navigate('/select-process');
    } else {
      navigate('/select-locker');
    }
  };

  const handleRefreshData = async () => {
    ['scannedBagData', 'scannedJobMaterialData', 'scannedJobListData'].forEach(
      (k) => sessionStorage.removeItem(k),
    );
    [
      'allLockerData', 'allJobMaterialData', 'allJobListData', 'allEngagedMaterial',
      'allEmployeeLockerData', 'allEmployeeData', 'allBagListData',
    ].forEach((k) => removeMaster(k));
    await refreshSessionData(setIsLoading);
  };

  return (
    <div className="scan-employee page-enter">
      <Button className="scan-employee__theme-btn homebtn1" onClick={toggleSelector} title="Switch Theme"
        style={{ position: 'absolute', top: '15px', right: '-60%', backgroundColor: '#6366f1', zIndex: 999999 }}>
        {currentTheme === 'theme1' ? <Moon size={16} /> : <Sun size={16} />}
        <span>{currentTheme === 'theme1' ? 'Dark' : currentTheme === 'system' ? 'System' : 'Light'}</span>
        <Palette size={14} />
      </Button>

      <Button className="scan-employee__theme-btn homebtn2" onClick={handleRefreshData} title="Refresh Data"
        style={{ position: 'absolute', top: '15px', right: '-45%', backgroundColor: '#6366f1', zIndex: 999999 }}>
        <RefreshCw size={16} />
        <span>Refresh</span>
      </Button>

      <div className="scan-employee__job-verify">
        <FormControlLabel
          className="scan-employee__job-verify-toggle"
          control={
            <Switch
              checked={jobVerification}
              onChange={handleJobVerificationChange}
              size="small"
              color="primary"
            />
          }
          label="Job Verification"
          labelPlacement="start"
        />
        <span className={`scan-employee__job-verify-state ${jobVerification ? 'scan-employee__job-verify-state--on' : ''}`}>
          {jobVerification ? 'ON' : 'OFF'}
        </span>
      </div>

      <div className="scan-employee__header">
        <div className="scan-employee__step-badge">Step 1</div>
        <h1 className="scan-employee__title">Scan Employee</h1>
        <p className="scan-employee__desc">Scan employee barcode or enter employee code to begin</p>
      </div>

      <div className="scan-employee__scanner-card">
        <div className="scan-employee__scanner-visual">
          <div className={`scan-employee__scanner-frame ${isScanning ? 'scan-employee__scanner-frame--scanning' : ''}`}>
            <ScanLine size={48} className="scan-employee__scanner-icon" />
            {isScanning && <div className="scan-employee__scan-line" />}
          </div>
          <span className="scan-employee__scanner-label">
            {isScanning ? 'Scanning...' : 'Ready to Scan'}
          </span>
        </div>

        <div className="scan-employee__input-group">
          <div className="scan-employee__input-wrapper">
            <ScanLine size={18} className="scan-employee__input-icon" />
            <input
              ref={inputRef}
              type="text"
              className="scan-employee__input"
              placeholder="Scan barcode or type employee bcode (e.g., E0121)"
              value={scanValue}
              onChange={(e) => {
                setScanValue(e.target.value);
                setError('');
                setFoundEmployee(null);
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          {error && <span className="scan-employee__error">{error}</span>}
          <Button
            variant="contained"
            onClick={handleScan}
            disabled={isScanning}
            className="scan-employee__scan-btn"
            startIcon={<ScanLine size={18} />}
          >
            {isScanning ? 'Scanning...' : 'Scan Employee'}
          </Button>
        </div>
      </div>

      {foundEmployee && (
        <div className="scan-employee__result">
          <div className="scan-employee__result-card">
            <div className="scan-employee__result-icon">
              <BadgeCheck size={32} />
            </div>
            <div className="scan-employee__result-info">
              <div className="scan-employee__result-badge">Employee Verified</div>
              <h3 className="scan-employee__result-name">{foundEmployee.name?.trim() || foundEmployee.code}</h3>
              <div className="scan-employee__result-details">
                <span className="scan-employee__result-code">
                  <User size={14} /> {foundEmployee.bcode}
                </span>
                <span className="scan-employee__result-desig">{foundEmployee.degn}</span>
              </div>
            </div>
          </div>

          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleContinue}
            endIcon={<ArrowRight size={20} />}
            className="scan-employee__continue-btn"
          >
            Continue to Select Locker
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScanEmployee;