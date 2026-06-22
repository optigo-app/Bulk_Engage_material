import React from 'react';
import { useEngage } from '../../context/EngageContext';
import { User, Lock, Layers, Package, ScanLine, CheckCircle2 } from 'lucide-react';
import './Sidebar.scss';

const steps = [
  { id: 1, label: 'Scan Employee', icon: ScanLine },
  { id: 2, label: 'Select Locker', icon: Lock },
  { id: 3, label: 'Select Process', icon: Layers },
  { id: 4, label: 'Scan Jobs', icon: Package },
  { id: 5, label: 'Bag Scanning', icon: ScanLine },
  { id: 6, label: 'Material Entry', icon: Package },
  { id: 7, label: 'Summary', icon: CheckCircle2 },
];

const Sidebar = () => {
  const { state } = useEngage();
  const { currentStep, employee, locker, processSubType, materialType, scannedJobs, scannedBags } = state;

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">EM</div>
          <div className="sidebar__logo-text">
            <span className="sidebar__title">Engage Material</span>
            <span className="sidebar__subtitle">Process Manager</span>
          </div>
        </div>
      </div>

      {employee && (
        <div className="sidebar__profile">
          <div className="sidebar__avatar">
            <User size={20} />
          </div>
          <div className="sidebar__profile-info">
            <span className="sidebar__name">{employee.name}</span>
            <span className="sidebar__code">{employee.code}</span>
          </div>
        </div>
      )}

      <div className={locker && "sidebar__details"}>
        {locker && (
          <div className="sidebar__detail-item">
            <Lock size={14} />
            <span>Locker {locker.name}</span>
          </div>
        )}
        
        {processSubType && (
          <div className="sidebar__detail-item">
            <Layers size={14} />
            <span>{processSubType.replace('-', ' → ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          </div>
        )}
        {materialType && (
          <div className="sidebar__detail-item">
            <Package size={14} />
            <span>{materialType.charAt(0).toUpperCase() + materialType.slice(1)}</span>
          </div>
        )}
        {scannedJobs.length > 0 && (
          <div className="sidebar__detail-item">
            <ScanLine size={14} />
            <span>Jobs: {scannedJobs.length}</span>
          </div>
        )}
        {scannedBags.length > 0 && (
          <div className="sidebar__detail-item">
            <CheckCircle2 size={14} />
            <span>Bags: {scannedBags.length}</span>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__nav-title">Steps</div>
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const isDisabled = currentStep < step.id;

          return (
            <div
              key={step.id}
              className={`sidebar__step ${isActive ? 'sidebar__step--active' : ''} ${isCompleted ? 'sidebar__step--completed' : ''} ${isDisabled ? 'sidebar__step--disabled' : ''}`}
            >
              <div className="sidebar__step-indicator">
                {isCompleted ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <div className="sidebar__step-content">
                <span className="sidebar__step-label">{step.label}</span>
              </div>
              {isActive && <div className="sidebar__step-active-bar" />}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
