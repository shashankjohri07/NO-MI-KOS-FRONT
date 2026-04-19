import { useState, useRef, useEffect } from 'react';
import '../styles/Select.css';

interface SelectOption {
  label: string;
  value: string;
  next?: string | string[];
  input_required?: boolean;
}

interface SelectProps {
  id: string;
  label: string;
  options: SelectOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showInput?: boolean;
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

export default function Select({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  showInput = false,
  inputValue = '',
  onInputChange,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayOptions = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selected = displayOptions.find((opt) => opt.value === value);

  return (
    <div className="select" ref={ref}>
      <label className="select__label" htmlFor={id}>
        {label}
      </label>

      <button
        type="button"
        id={id}
        className={`select__trigger ${open ? 'select__trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? 'select__value' : 'select__placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="select__arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="select__dropdown">
          {displayOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`select__option ${value === opt.value ? 'select__option--selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {showInput && (
        <input
          type="text"
          className="select__input"
          placeholder="Please specify..."
          value={inputValue}
          onChange={(e) => onInputChange?.(e.target.value)}
        />
      )}
    </div>
  );
}
