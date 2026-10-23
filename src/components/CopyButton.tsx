'use client';

import { useState } from 'react';

// Copies `value` to the clipboard. If the browser blocks that, it says so and the text stays selectable on the page.
export default function CopyButton({ value, label = 'Copy', className = 'btn btn-secondary' }: { value: string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2200);
  }
  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {state === 'done' ? 'Copied' : state === 'failed' ? 'Select the text and copy it' : label}
    </button>
  );
}
