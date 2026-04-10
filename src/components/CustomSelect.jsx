import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const CustomSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  className = '',
  disabled = false,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isOpenUp, setIsOpenUp] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const menuWidth = compact ? Math.max(rect.width, 60) : Math.min(Math.max(rect.width, 160), 250); // Better estimate
      const menuHeightWithPadding = Math.min(options.length * 48 + 16, 320);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      let openUp = false;

      if (spaceBelow < menuHeightWithPadding && spaceAbove > spaceBelow) {
        top = rect.top + window.scrollY - 8;
        openUp = true;
      } else {
        top = rect.bottom + window.scrollY + 8;
        openUp = false;
      }

      // Horizontal boundary check
      let left = rect.left + window.scrollX;
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 4;
      }
      if (left < 4) left = 4;

      setIsOpenUp(openUp);
      setMenuPosition({
        top: top,
        left: left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    if (disabled) return;
    onChange(option);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt =>
    typeof opt === 'string' ? opt === value : opt.value === value
  );

  const displayValue = selectedOption
    ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.label)
    : placeholder;

  const dropdownMenu = (
    <>
      {/* Invisible backdrop to capture clicks */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setIsOpen(false)}
      />

      <div
        ref={menuRef}
        style={{
          position: 'absolute',
          top: menuPosition.top,
          left: menuPosition.left,
          minWidth: menuPosition.width,
          width: 'max-content',
          maxWidth: '250px',
          zIndex: 9999,
          transform: isOpenUp ? 'translateY(-100%)' : 'translateY(0)',
          transformOrigin: isOpenUp ? 'bottom' : 'top'
        }}
        className=""
      >
        <div className={`bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] overflow-hidden bg-white/98 rounded-2xl border border-gray-100 ${isOpenUp ? 'mb-2' : 'mt-0'}`}>
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-2">
            {options.map((option, index) => {
              const optLabel = typeof option === 'string' ? option : option.label;
              const optValue = typeof option === 'string' ? option : option.value;
              const isSelected = optValue === value;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelect(optValue)}
                  className={`w-full ${compact ? 'px-3 py-2' : 'px-5 py-3'} text-left text-sm font-bold flex items-center justify-between group
                    ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'}
                  `}
                >
                  <span className="whitespace-nowrap">{optLabel}</span>
                  {isSelected && (
                    <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center scale-100 shadow-sm shadow-indigo-200">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full ${compact ? 'px-2 py-1.5' : 'px-5 py-3'} bg-white border-2 rounded-xl text-left text-sm font-bold flex items-center justify-between shadow-sm
            ${isOpen ? 'border-indigo-500' : 'border-gray-100 hover:border-gray-200'}
            ${error ? 'border-red-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
          `}
        >
          <span className={`truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-800'}`}>
            {displayValue}
          </span>
          <svg
            className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-gray-400 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && createPortal(dropdownMenu, document.body)}
      </div>

      {error && (
        <div className="text-red-500 text-xs mt-1.5 font-bold flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
