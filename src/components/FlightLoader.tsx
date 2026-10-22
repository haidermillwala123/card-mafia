// A plane that takes off along a dashed arc, for every loading state. Pure CSS (see .fl in globals.css); reduced motion shows it still.
export default function FlightLoader({ label = 'Loading', size = 'md' }: { label?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`fl fl-${size}`} role="status" aria-live="polite">
      <div className="fl-sky" aria-hidden="true">
        <svg className="fl-arc" viewBox="0 0 240 90" fill="none">
          <path d="M8 72 C 70 72, 100 24, 228 18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 6" strokeLinecap="round" />
          <path d="M0 78 H240" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
        </svg>
        <span className="fl-cloud fl-c1" />
        <span className="fl-cloud fl-c2" />
        <span className="fl-plane">
          <svg viewBox="0 0 32 32" width="100%" height="100%" fill="currentColor">
            <path d="M30 16 3 7l4 9-4 9 27-9Zm-17 0 8-1.6L11 12l2 4Z" />
          </svg>
        </span>
      </div>
      <span className="fl-label">{label}</span>
    </div>
  );
}
