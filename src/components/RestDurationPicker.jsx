import { useState } from 'react';
import { Timer } from 'lucide-react';

const PRESETS = [
  { label: 'Default', value: null },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
];

const PRESET_VALUES = new Set(PRESETS.map((p) => p.value));

function isCustomValue(value) {
  return value !== null && !PRESET_VALUES.has(value);
}

function formatBadge(seconds) {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}min`;
  return `${seconds}s`;
}

export default function RestDurationPicker({ value, onChange, isOpen, onToggle }) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState(value != null ? String(value) : '');

  const isOtherActive = isCustomValue(value);

  if (!isOpen) {
    return (
      <button
        className="rest-picker__trigger"
        onClick={onToggle}
        aria-label="Rest duration"
      >
        <Timer size={14} />
        {value != null && <span className="rest-picker__badge">{formatBadge(value)}</span>}
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
    if (!isNaN(num) && num > 0) {
      onChange(num);
    }
  }

  function handleCustomKeyDown(e) {
    if (e.key === 'Enter') {
      handleCustomConfirm();
    }
  }

  return (
    <div className="rest-picker">
      <div className="rest-picker__pills">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={`rest-picker__pill${value === preset.value && !isOtherActive ? ' rest-picker__pill--active' : ''}`}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button
          className={`rest-picker__pill${isOtherActive || showCustomInput ? ' rest-picker__pill--active' : ''}`}
          onClick={handleOtherClick}
        >
          Other
        </button>
      </div>
      {(showCustomInput || isOtherActive) && (
        <div className="rest-picker__custom-input-wrap">
          <input
            type="number"
            className="input rest-picker__custom-input"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            onBlur={handleCustomConfirm}
            placeholder="seconds"
            min="1"
            autoFocus
          />
          <span className="rest-picker__custom-unit">sec</span>
        </div>
      )}
    </div>
  );
}
