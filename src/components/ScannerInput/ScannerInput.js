import React, { forwardRef } from 'react';
import { ScanLine } from 'lucide-react';
import Button from '@mui/material/Button';
import './ScannerInput.scss';

const ScannerInput = forwardRef(({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  placeholder = 'Scan barcode...',
  label = 'Ready to Scan',
  buttonLabel = 'Add',
  isScanning = false,
  disabled = false,
  inputDisabled = false,
  error = '',
  autoFocus = false,
  compact = false,
}, ref) => {
  const btnDisabled = disabled || !String(value).trim();

  if (compact) {
    return (
      <div className="scanner-input scanner-input--compact">
        <div className="scanner-input__wrapper">
          <ScanLine size={18} className="scanner-input__input-icon" />
          <input
            ref={ref}
            type="text"
            className={`scanner-input__field ${error ? 'scanner-input__field--error' : ''}`}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={inputDisabled}
            autoFocus={autoFocus}
          />
          <Button
            variant="contained"
            size="small"
            onClick={onSubmit}
            disabled={btnDisabled}
            className="scanner-input__btn"
          >
            {buttonLabel}
          </Button>
        </div>
        {error && (
          <div className="scanner-input__error">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="scanner-input">
      <div className="scanner-input__visual">
        <div className={`scanner-input__frame ${isScanning ? 'scanner-input__frame--scanning' : ''}`}>
          <div className="scanner-input__barcode">
            <span /><span /><span /><span />
            <span /><span /><span /><span />
          </div>
          <div className="scanner-input__laser" />
          <ScanLine size={28} className="scanner-input__icon" />
        </div>
        <span className="scanner-input__label">
          {isScanning ? 'Scanning...' : label}
        </span>
      </div>
      <div className="scanner-input__body">
        <div className="scanner-input__wrapper">
          <ScanLine size={18} className="scanner-input__input-icon" />
          <input
            ref={ref}
            type="text"
            className={`scanner-input__field ${error ? 'scanner-input__field--error' : ''}`}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={inputDisabled}
            autoFocus={autoFocus}
          />
          <Button
            variant="contained"
            size="small"
            onClick={onSubmit}
            disabled={btnDisabled}
            className="scanner-input__btn"
          >
            {buttonLabel}
          </Button>
        </div>
        {error && (
          <div className="scanner-input__error">{error}</div>
        )}
      </div>
    </div>
  );
});

export default ScannerInput;
