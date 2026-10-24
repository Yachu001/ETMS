import React, { useState } from 'react';

/**
 * Universal Tooltip Component
 * @param {string|React.ReactNode} content - Text or node to render inside the popover
 * @param {string} position - 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 * @param {string} maxWidth - Tailwind max-w class (default: 'max-w-xs')
 * @param {React.ReactNode} children - The target element (anchor)
 */
export default function Tooltip({ 
  content, 
  children, 
  position = 'top', 
  maxWidth = 'max-w-xs',
  className = ''
}) {
  const [isVisible, setIsVisible] = useState(false);

  if (!content) return <>{children}</>;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent',
  };

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div 
          className={`absolute z-50 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 ${positionClasses[position]}`}
        >
          <div className={`bg-slate-900 text-slate-100 text-[11px] font-medium leading-relaxed px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-800 ${maxWidth} break-words whitespace-normal text-left`}>
            {content}
          </div>
          {/* Tooltip triangle arrow */}
          <div className={`w-0 h-0 border-4 absolute ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}