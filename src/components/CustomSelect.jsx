import { useState, useRef, useEffect } from 'react';

const CustomSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Select an option', 
  label,
  error,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-bold text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full px-3 py-2.5 sm:px-5 sm:py-3 bg-white border-2 rounded-xl text-left text-sm sm:text-base font-medium transition-all duration-300 flex items-center justify-between shadow-sm
            ${isOpen ? 'border-[#263B6A] ring-1 ring-[#263B6A]' : 'border-gray-200 hover:border-gray-300'}
            ${error ? 'border-red-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
          `}
        >
          <span className={`truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-800'}`}>
            {displayValue}
          </span>
          <svg 
            className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden animate-fade-in-up">
              <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto no-scrollbar py-2">
                {options.map((option, index) => {
                  const optLabel = typeof option === 'string' ? option : option.label;
                  const optValue = typeof option === 'string' ? option : option.value;
                  const isSelected = optValue === value;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelect(optValue)}
                      className={`w-full px-3 py-2.5 sm:px-5 sm:py-3 text-left text-sm sm:text-base font-semibold transition-colors flex items-center justify-between group
                        ${isSelected ? 'bg-blue-50 text-[#263B6A]' : 'text-gray-600 hover:bg-gray-50'}
                      `}
                    >
                      <span className="truncate">{optLabel}</span>
                      {isSelected && (
                        <svg className="w-4 h-4 text-[#263B6A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      
      {error && (
        <div className="text-red-500 text-xs mt-1 font-medium animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
