import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Plus, Check, X } from 'lucide-react';

export interface SelectOption {
  id: string;
  label: string; // nome_fantasia
  subLabel?: string; // razao_social
}

interface SearchableSelectProps {
  id: string;
  label: string;
  value: string; // current selected label (nome_fantasia)
  selectedId?: string | null;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  quickAddLabel?: string;
  onSelect: (option: SelectOption) => void;
  onQuickAdd?: () => void;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  label,
  value,
  selectedId,
  options,
  placeholder,
  searchPlaceholder = 'Digitar para filtrar...',
  quickAddLabel,
  onSelect,
  onQuickAdd,
  required = false,
  disabled = false,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(term))
    );
  });

  const handleSelect = (option: SelectOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {onQuickAdd && (
          <button
            type="button"
            id={`btn-quick-add-${id}`}
            onClick={onQuickAdd}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
          >
            <Plus className="w-3 h-3" />
            <span>{quickAddLabel || 'Novo'}</span>
          </button>
        )}
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 bg-slate-950/80 border ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700/80'
        } rounded-2xl px-3.5 py-2.5 text-left text-sm transition min-h-[46px] hover:border-slate-600 disabled:opacity-50`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          {value ? (
            <span className="font-semibold text-white truncate">{value}</span>
          ) : (
            <span className="text-slate-500 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-400' : ''
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-72 flex flex-col">
          {/* Search bar inside dropdown */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Add action button at top of options */}
          {onQuickAdd && quickAddLabel && (
            <div className="p-1.5 border-b border-slate-800 bg-blue-500/5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onQuickAdd();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-blue-400 hover:text-white hover:bg-blue-600 transition text-left min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{quickAddLabel}</span>
              </button>
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                <p>Nenhum registro encontrado.</p>
                {onQuickAdd && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onQuickAdd();
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Cadastrar agora</span>
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected =
                  (selectedId && opt.id === selectedId) ||
                  opt.label.toLowerCase() === value.toLowerCase();

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition min-h-[42px] ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300 font-semibold'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="text-[10px] text-slate-400 truncate">{opt.subLabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
