import Link from 'next/link';

export default function Logo() {
  return (
    <Link href="/" className="brand" aria-label="Card Mafia home">
      <span className="mark" aria-hidden="true">CM</span>
      Card Mafia
    </Link>
  );
}
