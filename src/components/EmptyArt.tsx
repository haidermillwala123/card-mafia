// A small friendly picture for empty screens: a plane leaving two clouds. Decorative, so hidden from screen readers.
export default function EmptyArt({ size = 120 }: { size?: number }) {
  return (
    <svg className="empty-art" width={size} height={size * 0.62} viewBox="0 0 160 100" fill="none" aria-hidden="true">
      <path d="M12 74c-8 0-12-5-12-10 0-6 5-10 11-10 1-8 8-14 17-14 7 0 13 4 15 10 8-1 15 4 15 12 0 7-5 12-12 12H12Z" fill="var(--primary-tint)" />
      <path d="M96 88c-7 0-11-4-11-9 0-5 4-9 10-9 1-7 7-12 15-12 6 0 11 3 13 8 7-1 13 3 13 10 0 6-4 12-11 12H96Z" fill="var(--surface-sunken)" />
      <path d="M142 22 74 6l12 22-12 22 68-28Z" fill="var(--primary)" />
      <path d="m142 22-45 12 4-14Z" fill="var(--primary-hover)" />
      <path d="M40 40c18 2 28-4 34-14" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
    </svg>
  );
}
