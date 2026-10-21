import { ImageResponse } from 'next/og';

export const alt = 'Card Mafia: know the plan before you move the points';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#181614', color: '#EDEBE6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 52, border: '3px solid #CDD1D6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#CDD1D6' }}>CM</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Card Mafia</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2 }}>Know the plan before you move the points.</div>
          <div style={{ fontSize: 32, color: '#AAA498' }}>Verified award-flight plans for Indian premium cardholders.</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 24, color: '#7FC4CC' }}>Rules checked. Seats dated. No logins.</div>
      </div>
    ),
    size,
  );
}
