import { useState, useRef, useEffect } from 'react';
import '../styles/HelpTooltip.css';

function HelpTooltip({ text, children, position = 'top' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const iconRef = useRef(null);
  const tooltipRef = useRef(null);

  // Smart positioning to avoid viewport edges
  useEffect(() => {
    if (!showTooltip || !iconRef.current || !tooltipRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let newPosition = position;

    // Check vertical space
    if (position === 'top' && iconRect.top < tooltipRect.height + 20) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && iconRect.bottom + tooltipRect.height + 20 > viewportHeight) {
      newPosition = 'top';
    }

    // Check horizontal space
    if (position === 'left' && iconRect.left < tooltipRect.width + 20) {
      newPosition = 'right';
    } else if (position === 'right' && iconRect.right + tooltipRect.width + 20 > viewportWidth) {
      newPosition = 'left';
    }

    setActualPosition(newPosition);
  }, [showTooltip, position]);

  return (
    <div className="help-tooltip-wrapper">
      <span 
        ref={iconRef}
        className="help-icon"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        role="button"
        tabIndex="0"
        aria-label="Help information"
        aria-expanded={showTooltip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setShowTooltip(!showTooltip);
          } else if (e.key === 'Escape') {
            setShowTooltip(false);
          }
        }}
      >
        <span className="help-icon-text">?</span>
      </span>
      {showTooltip && (
        <div 
          ref={tooltipRef}
          className={`help-tooltip help-tooltip-${actualPosition}`}
          role="tooltip"
        >
          <div className="tooltip-content">
            <p>{text}</p>
          </div>
          <div className="tooltip-arrow"></div>
        </div>
      )}
      {children}
    </div>
  );
}

export default HelpTooltip;
