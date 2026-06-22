import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { ScanLine, User, BadgeCheck, ArrowRight } from 'lucide-react';
import Button from '@mui/material/Button';
import './ScanEmployee.scss';

const ScanEmployee = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [scanValue, setScanValue] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [foundEmployee, setFoundEmployee] = useState(null); // ← local preview only
  const inputRef = useRef(null);
  const allemployeeLockerRights = JSON.parse(sessionStorage.getItem('allEmployeeLockerData'));

  useEffect(() => {
    actions.setStep(1);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = () => {
    if (!scanValue.trim()) {
      setError('Please scan or enter employee code');
      return;
    }
    setIsScanning(true);
    setError('');
    setFoundEmployee(null);

    setTimeout(() => {
      // Read allEmployeeData from sessionStorage
      let allEmployees = [];
      try {
        const raw = sessionStorage.getItem('allEmployeeData');
        allEmployees = raw ? JSON.parse(raw) : [];
      } catch {
        allEmployees = [];
      }

      // Match by bcode (barcode scan) — case-insensitive
      const emp = allEmployees.find(
        (e) => e.bcode?.toLowerCase() === scanValue.trim().toLowerCase()
      );

      if (emp) {
        // Only store in local state — NOT in context yet
        setFoundEmployee(emp);
      } else {
        setError('Employee not found. Please try again.');
      }

      setIsScanning(false);
    }, 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  const handleContinue = () => {
    if (!foundEmployee) return;

    // Commit employee to context
    actions.setEmployee(foundEmployee);

    // Check if this employee already has a locker assigned
    let empLocker = null;
    try {
      const raw = sessionStorage.getItem('allEmployeeLockerData');
      const empLockers = raw ? JSON.parse(raw) : [];
      empLocker = empLockers.find(
        (el) =>
          el.bcode === foundEmployee.bcode ||
          el.empcode === foundEmployee.code ||
          el.code === foundEmployee.code
      );
    } catch {
      empLocker = null;
    }

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

  return (
    <div className="scan-employee page-enter">
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
                setFoundEmployee(null); // clear preview on new input
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

      {/* Show result from LOCAL foundEmployee state — not from context */}
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