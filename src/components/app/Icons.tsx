// Lucide outlines, drawn by CSS masks (see ds/app.css), so they take the text colour.
export type IconName = 'clock' | 'badge' | 'arrow' | 'ext' | 'alert' | 'shield' | 'user' | 'copy' | 'search' | 'home' | 'more' | 'lock';

export default function Ic({ name, small = false }: { name: IconName; small?: boolean }) {
  return <span className={`a-i a-i-${name}${small ? ' a-s' : ''}`} aria-hidden="true" />;
}
