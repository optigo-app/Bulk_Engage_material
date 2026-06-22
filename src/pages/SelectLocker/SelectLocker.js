import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngage } from '../../context/EngageContext';
import { Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import Button from '@mui/material/Button';
import './SelectLocker.scss';

const getLockerData = () => {
  try {
    const raw = sessionStorage.getItem('allLockerData');
    if (!raw) return [];
    const apiData = JSON.parse(raw);
    return apiData.map((l) => ({
      id: l.lid ?? l.id ?? l.lockerno,
      name: l.lname ?? l.name ?? l.lockername ?? `Locker ${l.lid ?? l.id ?? l.lockerno}`,
      status: l.status ?? 'available',
      items: l.items ?? l.itemcount ?? 0,
    }));
  } catch {
    return [];
  }
};

const getAllEmployeeLockerRights = () => {
  try {
    const raw = sessionStorage.getItem('allEmployeeLockerData');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const SelectLocker = () => {
  const navigate = useNavigate();
  const { state, actions } = useEngage();
  const [lockers, setLockers] = useState([]);

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

    // Step 3: Filter lockers to only those the employee has rights to,
    //         and attach a `canWrite` flag
    const allowedLockerIds = new Set(Object.keys(lockerRightsMap).map(Number));

    const filteredLockers = allLockers
      .filter((l) => allowedLockerIds.has(l.id))
      .map((l) => ({
        ...l,
        canWrite: lockerRightsMap[l.id] === true,
      }));

    setLockers(filteredLockers);
  }, []);

  const handleSelect = (locker) => {
    // Only allow selection if available AND has write access
    if (locker.status === 'available' && locker.canWrite) {
      actions.setLocker(locker);
    }
  };

  const handleContinue = () => {
    if (state.locker) {
      navigate('/select-process');
    }
  };

  return (
    <div className="select-locker page-enter">
      <div className="select-locker__header">
        <div className="select-locker__step-badge">Step 2</div>
        <h1 className="select-locker__title">Select Locker</h1>
        <p className="select-locker__desc">Choose a locker to assign for this engage process</p>
      </div>

      <div className="select-locker__grid">
        {lockers.map((locker) => {
          const isSelected = state.locker?.id === locker.id;
          const isDisabled = locker.status !== 'available' || !locker.canWrite;

          return (
            <div
              key={locker.id}
              className={[
                'select-locker__card',
                isSelected ? 'select-locker__card--selected' : '',
                isDisabled ? 'select-locker__card--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(locker)}
            >
              <div className="select-locker__card-icon">
                <Lock size={24} />
              </div>
              <h3 className="select-locker__card-name">{locker.name}</h3>
              <span
                className={`select-locker__card-status select-locker__card-status--${locker.status}`}
              >
                {locker.status}
              </span>
              {!locker.canWrite && (
                <span className="select-locker__card-no-write">Read Only</span>
              )}
              {isSelected && (
                <div className="select-locker__card-check">✓</div>
              )}
            </div>
          );
        })}
      </div>
      {lockers.length === 0 && (
        <p className="select-locker__empty" style={{height: '300px', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>No lockers assigned to this employee.</p>
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
          variant="contained"
          color="primary"
          size="large"
          onClick={handleContinue}
          disabled={!state.locker}
          endIcon={<ArrowRight size={20} />}
          className="select-locker__continue-btn"
        >
          Continue to Select Process
        </Button>
      </div>
    </div>
  );
};

export default SelectLocker;