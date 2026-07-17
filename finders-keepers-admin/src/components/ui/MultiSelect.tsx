'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional secondary line, e.g. a parent category path. */
  hint?: string;
}

interface MultiSelectProps {
  label?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

/**
 * Searchable multi-select with keyboard support.
 *
 * Built on plain elements rather than a new dependency, matching the rest of
 * the admin's hand-rolled UI kit.
 */
export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search and select...',
  error,
  emptyMessage = 'No matches',
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => setActiveIndex(0), [query, open]);

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) toggle(option.value);
    } else if (e.key === 'Backspace' && !query && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      )}

      <div
        className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 ${
          error ? 'border-red-400' : 'border-slate-300'
        } ${disabled ? 'cursor-not-allowed bg-slate-50' : 'cursor-text'}`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selected.map((option) => (
          <span
            key={option.value}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
          >
            {option.label}
            <button
              type="button"
              aria-label={`Remove ${option.label}`}
              className="text-slate-400 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                toggle(option.value);
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="multiselect-list"
          autoComplete="off"
          disabled={disabled}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm outline-none placeholder:text-slate-400"
          placeholder={selected.length ? '' : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />

        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && !disabled && (
        <ul
          id="multiselect-list"
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</li>
          )}

          {filtered.map((option, i) => {
            const isSelected = value.includes(option.value);
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  i === activeIndex ? 'bg-slate-100' : ''
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(option.value);
                }}
              >
                <span>
                  <span className="text-slate-800">{option.label}</span>
                  {option.hint && (
                    <span className="ml-2 text-xs text-slate-400">{option.hint}</span>
                  )}
                </span>
                {isSelected && <Check size={14} className="text-green-600" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
