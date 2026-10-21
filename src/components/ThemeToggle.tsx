'use client';

// One contrast icon for both themes, so the button needs no state and cannot mismatch on hydration.
export default function ThemeToggle() {
  const flip = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try {
      localStorage.setItem('cm-theme', next);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  };
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label="Switch light or dark theme">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </svg>
    </button>
  );
}
