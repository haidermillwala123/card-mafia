// Small stroke icons, 1.5px, matching the spec sheet. Decorative: the text beside them carries the meaning.
const P = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const Check = (p: { size?: number }) => <P d="m5 12.5 4.5 4.5L19 7.5" {...p} />;
export const Warn = (p: { size?: number }) => <P d="M12 4 2.5 20h19L12 4ZM12 10v5M12 17.5v.5" {...p} />;
export const Lock = (p: { size?: number }) => <P d="M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3" {...p} />;
export const Arrow = (p: { size?: number }) => <P d="M5 12h14M13 6l6 6-6 6" {...p} />;
export const Back = (p: { size?: number }) => <P d="M19 12H5M11 6l-6 6 6 6" {...p} />;
export const Clock = (p: { size?: number }) => <P d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" {...p} />;
export const Close = (p: { size?: number }) => <P d="M6 6l12 12M18 6 6 18" {...p} />;
export const Info = (p: { size?: number }) => <P d="M12 11v6M12 7.5v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" {...p} />;
