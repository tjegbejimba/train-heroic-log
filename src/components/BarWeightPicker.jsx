import { useState } from 'react';
import { Dumbbell } from 'lucide-react';

const LB_PRESETS = [
  { label: 'Default (45)', value: null },
  { label: '35', value: 35 },
  { label: '55', value: 55 },
  { label: '60', value: 60 },
  { label: '0', value: 0 },
];

const KG_PRESETS = [
  { label: 'Default (20)', value: null },
  { label: '15', value: 15 },
  { label: '25', value: 25 },
  { label: '0', value: 0 },
];

function getPresets(unit) {
  return unit === 'kg' ? KG_PRESETS : LB_PRESETS;
}

function getPresetValues(unit) {
  return new Set(getPresets(unit).map((p) => p.value));
}

function isCustomValue(value, unit) {
  return value !== null && !getPresetValues(unit).has(value);
}

export default function BarWeightPicker({ value, onChange, isOpen, onToggle, unit = 'lb' }) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState(value != null ? String(value) : '');

  const presets = getPresets(unit);
  const isOtherActive = isCustomValue(value, unit);

  if (!isOpen) {
    return (
      <button
        className="bar-weight-picker__trigger"
        onClick={onToggle}
        aria-label="Bar weight"
      >
        <Dumbbell size={14} />
        {value != null && <span className="bar-weight-picker__badge">{value} {unit}</span>}
      </button>
    );
  }

  function handlePresetClick(presetValue) {
    setShowCustomInput(false);
    onChange(presetValue);
  }

  function handleOtherClick() {
    setShowCustomInput(true);
    setCustomValue(value != null ? String(value) : '');
  }

  function handleCustomConfirm() {
    const num = parseInt(customValue, 10);
    if (!isNaN(num) && num >= 0) {
      onChange(num);
    }
  }

  function handleCustomKeyDown(e) {
    if (e.key === 'Enter') {
      handleCustomConfirm();
    }
  }

  return (
    <div className="bar-weight-picker">
      <div className="bar-weight-picker__pills">
        {presets.map((preset) => (
          <button
            key={preset.label}
            className={`bar-weight-picker__pill${value === preset.value && !isOtherActive ? ' bar-weight-picker__pill--active' : ''}`}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button
          className={`bar-weight-picker__pill${isOtherActive || showCustomInput ? ' bar-weight-picker__pill--active' : ''}`}
          onClick={handleOtherClick}
        >
          Other
        </button>
      </div>
      {(showCustomInput || isOtherActive) && (
        <div className="bar-weight-picker__custom-input-wrap">
          <input
            type="number"
            className="input bar-weight-picker__custom-input"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            onBlur={handleCustomConfirm}
            placeholder="weight"
            min="0"
            autoFocus
          />
          <span className="bar-weight-picker__custom-unit">{unit}</span>
        </div>
      )}
    </div>
  );
}
