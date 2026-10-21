// Shared Card Mafia globe: land-mask dot sphere + great-circle routes. Land from Natural Earth 110m, packed to a 2-degree grid.
(() => {
'use strict';
const MASK = { step: 2, rows: 91, cols: 180, b64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf4AP/AAAAAAAAAAAAAAAAAAAAAAAAX/z///+AAAAAAAABAAAAAAAAAAAAAYd8P///wAA+AAAAAA8AAAAAAAAAAAwAnw////4AAIAAAAAAGAAAAAAAAAAADivwAf//wAAAAADAAf/wAHYAAAAAADoi3sAP//gAAAAAMAD///sAAAAgBgACfwz/AD/+gAAAwAEHf///////+AP//////////////4A//EgAAAAAAAgH///////////////gAFAAgAAAAAAAAz///////////////BhQAAAAAAAAAAAAP/////4A0B4AAAD5/////////////Af3////gHgA4AAAH5///////////LwAHgH///gHkAAAAAH4/////////+CIAABAB///4D+AAAAGCx/////////4A8AAIAAf///n/gAAAOCD/////////wA4AAAAAf///n/wAAAbP///////////AgAAAAAP/////wAAADf//////////9AAAAAAAF////0YAAAB///////////9AAAAAAAD////8EAAAB///////////5AAAAAAAD////2AAAAB/f5fP//////wAAAAAAAD////gAAAAfxnwPP//////jAAAAAAAD////AAAAAPCb3/n/////+CAAAAAAAD///8AAAAAfALf/n////+ECAAAAAAAB///8AAAAAGHQP/n/////mMAAAAAAAA///8AAAAAH+Ai///////E8AAAAAAAAf//wAAAAAP/AA///////BgAAAAAAAAP//gAAAAAf/73///////gAAAAAAAAAD/AQAAAAAf////f/////gAAAAAAAAAF+AQAAAAB///+/n/////AAAAAAAAAAC+AAAAAAB///+f0H////AAAAAAAAAAAeAwAAAAD////f/B///8gAAAAAAAAAAeGEAAAAH////v+B/z/AAAAAAAAAAAAPMAgAAAD////n+A/B+gAAAAAAAAAAAD8AAAAAD////n4AeB/AgAAAAAAAAAAAPAAAAAH////3gAcAfAgAAAAAAAAAAADAAAAAD////6AAcAfggAAAAAAAAAAABDwAAAD////8wAMATAIAAAAAAAAAAAAr/AAAB/////gAKASAAAAAAAAAAAAAAH/gAAA/////gACAAAIAAAAAAAAAAAAH/8AAAaH///AAAAsGAAAAAAAAAAAAAH/+AAAAB//+AAAAUOAAAAAAAAAAAAAP/+AAAAB//8AAAAYegAAAAAAAAAAAAP//gAAAD//4AAAAMeBgAAAAAAAAAAAP//8AAAB//wAAAAGdiuAAAAAAAAAAAf///AAAA//wAAAACAQHgAAAAAAAAAAP///gAAA//wAAAABwAHwgAAAAAAAAAH///AAAA//wAAAAACIDQIAAAAAAAAAH//+AAAAf/wAAAAAAAAAAAAAAAAAAAD//+AAAA//wgAAAAABxAAAAAAAAAAAD//+AAAA//wgAAAAAPxgBAAAAAAAAAA//8AAAA//jgAAAAAf5gAAAAAAAAAAAf/8AAAA//DgAAAAAf/gAAAAAAAAAAAf/8AAAAf/DAAAAAD//4CAAAAAAAAAAf/wAAAAf/DAAAAAH//4AAAAAAAAAAAf/AAAAAf+CAAAAAH//8AAAAAAAAAAAf/AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAD//+AAAAAAAAAAA/8AAAAAHwAAAAAADwf8AAAAAAAAAAA/gAAAAAAAAAAAAACAH4AIAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB+AAAAAAAAAAAAAAAAAAAGAAAAAAAAB6AAAAAAAAAAAAAAAAAwAMAAAAAAAAA8AAAAAAAAAAAAAAAAAQAYAAAAAAAAB4AAAAAAAAAAAAAAAAAAAwAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAACAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAeAAIP+f/gAAAAAAAAAAAMAAAAAAABP/+H//////AAAAAAAAAAA+AAAAAf////8////////AAAAAAAOEAPAAAB///////////////gAAAP//T//8AAAH//////////////+AAAH/////4AAAH///////////////8AAE//////4ABw////////////////8AAAD//////gCA////////////////wAAAf/////////////////////////+AAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
const bytes = Uint8Array.from(atob(MASK.b64), c => c.charCodeAt(0));
const land = (r, c) => { const i = r * MASK.cols + c; return (bytes[i >> 3] >> (7 - (i & 7))) & 1; };
// Airports: code, latitude, longitude, label priority (1 = hub, labelled first; 2 = labelled when there is room, always on hover), name.
const AIR = `
BOM 19.09 72.87 1 Mumbai
DEL 28.56 77.10 1 Delhi
DOH 25.27 51.56 1 Doha
DXB 25.25 55.36 1 Dubai
LHR 51.47 -0.45 1 London Heathrow
JFK 40.64 -73.78 1 New York JFK
SIN 1.36 103.99 1 Singapore
CDG 49.00 2.55 1 Paris
SFO 37.62 -122.38 1 San Francisco
SYD -33.94 151.18 1 Sydney
IST 41.28 28.75 1 Istanbul
HKG 22.31 113.91 1 Hong Kong
HND 35.55 139.78 1 Tokyo Haneda
LAX 33.94 -118.41 1 Los Angeles
FRA 50.03 8.57 1 Frankfurt
AMS 52.31 4.76 1 Amsterdam
JNB -26.14 28.25 1 Johannesburg
GRU -23.43 -46.47 1 Sao Paulo
ORD 41.98 -87.90 1 Chicago O'Hare
ATL 33.64 -84.43 1 Atlanta
CAI 30.12 31.41 1 Cairo
NBO -1.32 36.93 1 Nairobi
YYZ 43.68 -79.63 1 Toronto
MEX 19.44 -99.07 1 Mexico City
BOG 4.70 -74.15 1 Bogota
SCL -33.39 -70.79 1 Santiago
SEA 47.45 -122.31 1 Seattle
ADD 8.98 38.80 1 Addis Ababa
LOS 6.58 3.32 1 Lagos
CPT -33.97 18.60 1 Cape Town
EZE -34.82 -58.54 1 Buenos Aires
BLR 13.20 77.71 2 Bengaluru
MAA 12.99 80.17 2 Chennai
HYD 17.24 78.43 2 Hyderabad
CCU 22.65 88.45 2 Kolkata
COK 10.15 76.40 2 Kochi
AMD 23.07 72.63 2 Ahmedabad
GOI 15.38 73.83 2 Goa
CMB 7.18 79.88 2 Colombo
MLE 4.19 73.53 2 Male
KTM 27.70 85.36 2 Kathmandu
DAC 23.84 90.40 2 Dhaka
BKK 13.69 100.75 2 Bangkok
KUL 2.75 101.71 2 Kuala Lumpur
CGK -6.13 106.66 2 Jakarta
DPS -8.75 115.17 2 Bali
MNL 14.51 121.02 2 Manila
SGN 10.82 106.66 2 Ho Chi Minh City
HAN 21.22 105.81 2 Hanoi
ICN 37.46 126.44 2 Seoul
PEK 40.08 116.58 2 Beijing
PVG 31.14 121.81 2 Shanghai
CAN 23.39 113.30 2 Guangzhou
TPE 25.08 121.23 2 Taipei
KIX 34.43 135.24 2 Osaka
RUH 24.96 46.70 2 Riyadh
JED 21.68 39.16 2 Jeddah
MCT 23.59 58.28 2 Muscat
KWI 29.23 47.97 2 Kuwait City
BAH 26.27 50.63 2 Bahrain
TLV 32.01 34.89 2 Tel Aviv
AMM 31.72 35.99 2 Amman
MAD 40.47 -3.57 2 Madrid
BCN 41.30 2.08 2 Barcelona
FCO 41.80 12.25 2 Rome
MUC 48.35 11.79 2 Munich
ZRH 47.46 8.55 2 Zurich
VIE 48.11 16.57 2 Vienna
CPH 55.62 12.65 2 Copenhagen
ARN 59.65 17.92 2 Stockholm
OSL 60.20 11.10 2 Oslo
HEL 60.32 24.96 2 Helsinki
DUB 53.42 -6.27 2 Dublin
LIS 38.77 -9.13 2 Lisbon
ATH 37.94 23.94 2 Athens
MAN 53.35 -2.27 2 Manchester
BRU 50.90 4.48 2 Brussels
WAW 52.17 20.97 2 Warsaw
KEF 63.99 -22.60 2 Reykjavik
CMN 33.37 -7.59 2 Casablanca
ALG 36.69 3.22 2 Algiers
TUN 36.85 10.23 2 Tunis
ACC 5.61 -0.17 2 Accra
DKR 14.67 -17.07 2 Dakar
DAR -6.88 39.20 2 Dar es Salaam
LUN -15.33 28.45 2 Lusaka
MRU -20.43 57.68 2 Mauritius
SEZ -4.67 55.52 2 Seychelles
MEL -37.67 144.84 2 Melbourne
BNE -27.38 153.12 2 Brisbane
PER -31.94 115.97 2 Perth
ADL -34.95 138.53 2 Adelaide
AKL -37.01 174.79 2 Auckland
CHC -43.49 172.53 2 Christchurch
NAN -17.76 177.44 2 Fiji
HNL 21.32 -157.92 2 Honolulu
ANC 61.17 -149.99 2 Anchorage
DFW 32.90 -97.04 2 Dallas Fort Worth
DEN 39.86 -104.67 2 Denver
MIA 25.79 -80.29 2 Miami
BOS 42.36 -71.01 2 Boston
IAD 38.95 -77.46 2 Washington Dulles
EWR 40.69 -74.17 2 Newark
LAS 36.08 -115.15 2 Las Vegas
PHX 33.43 -112.01 2 Phoenix
IAH 29.98 -95.34 2 Houston
MSP 44.88 -93.22 2 Minneapolis
DTW 42.21 -83.35 2 Detroit
PHL 39.87 -75.24 2 Philadelphia
CLT 35.21 -80.94 2 Charlotte
SLC 40.79 -111.98 2 Salt Lake City
MCO 28.43 -81.31 2 Orlando
SAN 32.73 -117.19 2 San Diego
PDX 45.59 -122.60 2 Portland
AUS 30.19 -97.67 2 Austin
BNA 36.13 -86.68 2 Nashville
STL 38.75 -90.37 2 St Louis
MSY 29.99 -90.26 2 New Orleans
TPA 27.98 -82.53 2 Tampa
CLE 41.41 -81.85 2 Cleveland
PIT 40.49 -80.23 2 Pittsburgh
MCI 39.30 -94.71 2 Kansas City
RDU 35.88 -78.79 2 Raleigh Durham
SJC 37.36 -121.93 2 San Jose
SMF 38.70 -121.59 2 Sacramento
BWI 39.18 -76.67 2 Baltimore
FLL 26.07 -80.15 2 Fort Lauderdale
IND 39.72 -86.29 2 Indianapolis
CVG 39.05 -84.67 2 Cincinnati
YVR 49.19 -123.18 2 Vancouver
YUL 45.47 -73.74 2 Montreal
YYC 51.11 -114.02 2 Calgary
YEG 53.31 -113.58 2 Edmonton
YOW 45.32 -75.67 2 Ottawa
YWG 49.91 -97.24 2 Winnipeg
YHZ 44.88 -63.51 2 Halifax
YQB 46.79 -71.39 2 Quebec City
YYT 47.62 -52.75 2 St John's
CUN 21.04 -86.87 2 Cancun
SJO 9.99 -84.21 2 San Jose Costa Rica
PTY 9.07 -79.38 2 Panama City
HAV 22.99 -82.41 2 Havana
SJU 18.44 -66.00 2 San Juan
NAS 25.04 -77.47 2 Nassau
GIG -22.81 -43.25 2 Rio de Janeiro
BSB -15.87 -47.92 2 Brasilia
LIM -12.02 -77.11 2 Lima
UIO -0.14 -78.36 2 Quito
CCS 10.60 -66.99 2 Caracas
MVD -34.84 -56.03 2 Montevideo
`.trim().split('\n').map(l => { const [code, la, lo, tier, ...name] = l.split(' '); return [code, +la, +lo, +tier, name.join(' ')]; });
const CITY = {}, NAME = {}, TIER = {};
AIR.forEach(([code, la, lo, tier, name]) => { CITY[code] = [la, lo]; NAME[code] = name; TIER[code] = tier; });
// First route is the hero journey (labelled, glowing). The rest are ambient.
const ROUTES = [['BOM', 'DOH', 'JFK'], ['DEL', 'LHR'], ['BOM', 'SIN'], ['DEL', 'CDG'], ['BOM', 'DXB'], ['DEL', 'SFO'], ['BOM', 'IST'], ['DEL', 'HND'], ['SIN', 'SYD'], ['LHR', 'JFK'], ['DXB', 'JNB'], ['DOH', 'GRU'], ['HKG', 'LAX'], ['FRA', 'ORD'], ['AMS', 'YYZ'], ['BLR', 'BKK'], ['IST', 'JFK'],
  ['DXB', 'NBO'], ['CAI', 'LHR'], ['ADD', 'DEL'], ['CPT', 'LHR'], ['LOS', 'LHR'], ['CMN', 'CDG'], ['ACC', 'JFK'], ['NBO', 'BOM'], ['JNB', 'CPT'], ['DKR', 'LIS'], ['MRU', 'BOM'], ['DAR', 'DXB'], ['CAI', 'DXB'],
  ['GRU', 'EZE'], ['GRU', 'MIA'], ['SCL', 'MIA'], ['BOG', 'MIA'], ['LIM', 'IAH'], ['EZE', 'MAD'], ['GIG', 'LIS'], ['UIO', 'BOG'], ['SCL', 'SYD'], ['CCS', 'PTY'],
  ['ATL', 'LHR'], ['DFW', 'LAX'], ['ORD', 'ATL'], ['SEA', 'ANC'], ['DEN', 'SFO'], ['BOS', 'LHR'], ['MIA', 'CUN'], ['IAD', 'FRA'], ['EWR', 'DEL'], ['LAS', 'LAX'], ['PHX', 'DFW'], ['MSP', 'DTW'], ['CLT', 'PHL'], ['SLC', 'SEA'], ['MCO', 'ATL'], ['HNL', 'SYD'], ['HNL', 'LAX'],
  ['YVR', 'HND'], ['YUL', 'CDG'], ['YYC', 'YVR'], ['YYZ', 'YUL'], ['YHZ', 'LHR'], ['YEG', 'YYZ'], ['MEX', 'LAX'], ['MEX', 'MAD'],
  ['MEL', 'SIN'], ['AKL', 'SYD'], ['PER', 'SIN'], ['KUL', 'BOM'], ['PEK', 'FRA'], ['ICN', 'HND'], ['MAA', 'SIN'], ['CMB', 'BOM'], ['RUH', 'DXB'], ['TLV', 'IST']];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rad = Math.PI / 180;

window.CMGlobe = { airports: AIR.map(([code, lat, lon, tier, name]) => ({ code, lat, lon, tier, name })), init(cv, o = {}) {
  const c = cv.getContext('2d');
  const target = o.target || (() => 60), bias = o.bias || (() => 0), cxf = o.cx || (() => .52), rs = o.rscale || (() => 1), reveal = o.reveal || (() => 1), tiltDeg = o.tilt || (() => 24);
  // spin = free rotation (auto + drag); base = scroll-driven offset. yaw = base + spin.
  const auto = o.spin ?? 0, dragOn = !!o.drag, dragZone = o.dragZone || (() => true);
  let w = 0, h = 0, base = target(), spin = 0, vel = reduce ? 0 : auto, dragging = false, lastX = 0, lastY = 0, lastT = 0, yaw = base, t0 = performance.now();
  // play state: pointer, hovered / selected airport, fly-to target, extra tilt from vertical drag
  let mx = -999, my = -999, hover = null, sel = null, fly = null, tiltOff = 0, curs = '', down = null;
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); };
  const radius = () => Math.min(w, h) * (w < h ? .40 : .36) * rs();
  let ct = 1, st = 0;
  const vec = (lat, lon) => { const p = lat * rad, l = (lon - yaw) * rad; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
  const proj = (v, lift = 1) => { const [x, y, z] = v, y2 = y * ct - z * st, z2 = y * st + z * ct, R = radius(); return [w * cxf() + R * lift * x, h * .5 - R * lift * y2, z2 * lift]; };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const slerp = (a, b, t) => { const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(d), s = Math.sin(om) || 1, k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s; return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2]; };
  const arc = (A, B, t) => proj(slerp(vec(...A), vec(...B), t), 1 + 0.2 * Math.sin(Math.PI * t));
  function frame(now) {
    const dt = Math.min(now - t0, 50); t0 = now;
    base += (target() + bias() - base) * Math.min(1, dt * 0.0035);
    const flying = fly && now < fly.until;
    if (flying) { // glide the picked airport to the middle of the disc
      spin += (((fly.lon - (base + spin)) % 360 + 540) % 360 - 180) * Math.min(1, dt * 0.006); vel = 0;
      tiltOff += (fly.lat - tiltDeg() - tiltOff) * Math.min(1, dt * 0.006);
    } else if (!dragging) {
      spin += vel * dt; vel += ((reduce ? 0 : auto) - vel) * Math.min(1, dt * 0.0025); // coast back to idle spin after a flick
      tiltOff += (0 - tiltOff) * Math.min(1, dt * 0.0012);
    }
    yaw = base + spin;
    const tl = Math.max(-5, Math.min(70, tiltDeg() + tiltOff)) * rad; ct = Math.cos(tl); st = Math.sin(tl);
    c.clearRect(0, 0, w, h);
    const strong = css('--accent-strong'), text = css('--text'), muted = css('--text-muted'), R = radius(), cx = w * cxf(), cy = h * .5;
    const halo = c.createRadialGradient(cx, cy, R * .6, cx, cy, R * 1.3);
    halo.addColorStop(0, 'rgba(127,196,204,0)'); halo.addColorStop(.8, 'rgba(127,196,204,0.10)'); halo.addColorStop(1, 'rgba(127,196,204,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.3, 0, 7); c.fill();
    // land (bright) and ocean (faint) dots from the mask
    for (let r = 0; r < MASK.rows - 1; r++) {
      const lat = 89 - r * MASK.step, cs = Math.cos(lat * rad), m = Math.max(1, Math.round(.9 / Math.max(cs, .12)));
      for (let col = 0; col < MASK.cols; col += m) {
        const isLand = land(r, col);
        if (!isLand && ((r + (col / m | 0)) & 1)) continue;
        const [x, y, z] = proj(vec(lat, -179 + col * MASK.step));
        if (z < 0) continue;
        if (isLand) { c.fillStyle = text; c.globalAlpha = .22 + .62 * z; c.fillRect(x - 1, y - 1, 2, 2); }
        else { c.fillStyle = muted; c.globalAlpha = .06 + .12 * z; c.fillRect(x - .6, y - .6, 1.2, 1.2); }
      }
    }
    c.globalAlpha = 1;
    const rv = reveal();
    ROUTES.forEach((route, ri) => {
      const main = ri === 0, n = route.length - 1;
      for (let s = 0; s < n; s++) {
        const local = Math.max(0, Math.min(1, rv * n - s)); if (local <= 0) continue;
        const A = CITY[route[s]], B = CITY[route[s + 1]], steps = Math.max(2, Math.round(48 * local));
        c.lineWidth = main ? 1.8 : 1; c.strokeStyle = strong; c.globalAlpha = main ? .95 : .38;
        if (main) { c.shadowColor = strong; c.shadowBlur = 12; }
        c.beginPath(); let pen = false;
        for (let i = 0; i <= steps; i++) { const p = arc(A, B, (i / steps) * local); if (p[2] < 0.02) { pen = false; continue; } pen ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); pen = true; }
        c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1;
        if (local >= 1) { const p = arc(A, B, ((now * (main ? .00018 : .00012)) + ri * .31 + s * .5) % 1); if (p[2] > .02) { c.fillStyle = text; c.beginPath(); c.arc(p[0], p[1], main ? 2.6 : 1.8, 0, 7); c.fill(); } }
      }
    });
    c.font = '500 10px "JetBrains Mono", monospace';
    // airports facing us, nearest-to-pointer wins the hover
    const vis = []; hover = null; let best = 13;
    const canPlay = dragOn && !dragging && dragZone();
    for (const k in CITY) {
      const p = proj(vec(CITY[k][0], CITY[k][1])); if (p[2] < .05) continue;
      vis.push({ k, x: p[0], y: p[1], z: p[2] });
      const d = Math.hypot(p[0] - mx, p[1] - my); if (canPlay && d < best) { best = d; hover = k; }
    }
    vis.forEach(a => {
      const main = ROUTES[0].includes(a.k);
      c.fillStyle = main ? strong : muted; c.globalAlpha = main ? 1 : Math.min(1, a.z * 1.6); c.beginPath(); c.arc(a.x, a.y, main ? 3.2 : TIER[a.k] === 1 ? 2.2 : 1.6, 0, 7); c.fill();
      if (main) { const ph = (now * .0008) % 1; c.strokeStyle = strong; c.globalAlpha = 1 - ph; c.beginPath(); c.arc(a.x, a.y, 6 + 6 * ph, 0, 7); c.stroke(); }
    });
    c.globalAlpha = 1;
    // labels: hubs first, then others only where they do not collide
    const boxes = [], hit = (x, y, bw) => boxes.some(b => x < b[0] + b[2] && b[0] < x + bw && y < b[1] + 12 && b[1] < y + 12);
    vis.slice().sort((a, b) => (ROUTES[0].includes(b.k) - ROUTES[0].includes(a.k)) || TIER[a.k] - TIER[b.k] || b.z - a.z).forEach(a => {
      const main = ROUTES[0].includes(a.k), lx = a.x + (main ? 9 : 6), ly = a.y - 8;
      if (!main && (a.z < .3 || hit(lx, ly, 26))) return;
      boxes.push([lx, ly, 26]);
      c.globalAlpha = main ? 1 : Math.min(.85, (a.z - .3) * 1.7); c.fillStyle = main ? text : muted; c.fillText(a.k, lx, a.y + 3);
    });
    c.globalAlpha = 1;
    // hovered / picked airport: ring and name pill
    [sel, hover].forEach((k, i) => {
      const a = k && vis.find(v => v.k === k); if (!a || (i === 1 && k === sel)) return;
      c.strokeStyle = strong; c.lineWidth = 1.5; c.beginPath(); c.arc(a.x, a.y, 7, 0, 7); c.stroke();
      const label = `${k}  ${NAME[k]}`, tw = c.measureText(label).width + 20, px = Math.min(Math.max(8, a.x - tw / 2), w - tw - 8), py = a.y - 34;
      c.fillStyle = css('--surface'); c.globalAlpha = .94; c.beginPath(); c.roundRect(px, py, tw, 22, 11); c.fill();
      c.globalAlpha = 1; c.strokeStyle = css('--hair-strong'); c.lineWidth = 1; c.stroke();
      c.fillStyle = text; c.fillText(label, px + 10, py + 15);
    });
    const over = Math.hypot(mx - cx, my - cy) < R * 1.05 && canPlay, want = hover ? 'pointer' : over ? 'grab' : '';
    if (!dragging && want !== curs) document.body.style.cursor = curs = want;
    if (!document.hidden) requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { t0 = performance.now(); requestAnimationFrame(frame); } });
  // Drag to spin (mouse/pen only: touch keeps scrolling the page). Listens on window because page content sits above the canvas.
  const overGlobe = e => Math.hypot(e.clientX - w * cxf(), e.clientY - h * .5) < radius() * 1.05 && dragZone() && !e.target.closest?.('a,button,.nav');
  if (dragOn) {
    addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button || !overGlobe(e)) return;
      dragging = true; fly = null; lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp; vel = 0; down = { x: e.clientX, y: e.clientY, k: hover };
      document.body.style.cursor = curs = 'grabbing'; e.preventDefault();
    });
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY, dts = Math.max(1, e.timeStamp - lastT);
        spin -= dx * .32; vel = -dx * .32 / dts; tiltOff = Math.max(-25, Math.min(45, tiltOff + dy * .22));
        lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
      }
    });
    document.documentElement.addEventListener('pointerleave', () => { mx = my = -999; });
    const end = e => {
      if (!dragging) return; dragging = false; curs = ''; document.body.style.cursor = '';
      vel = Math.max(-.25, Math.min(.25, vel));
      if (down && e.type === 'pointerup' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) { // a click, not a drag
        sel = down.k;
        if (sel) { fly = { lon: CITY[sel][1], lat: CITY[sel][0], until: performance.now() + 2600 }; vel = 0; }
      }
      down = null;
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }
  addEventListener('resize', size); size(); requestAnimationFrame(frame);
  // controller: let the page steer the globe (quiz picks a destination, the globe flies there)
  return { flyTo(code) { if (!CITY[code]) return; sel = code; fly = { lon: CITY[code][1], lat: CITY[code][0], until: performance.now() + 2600 }; vel = 0; }, clear() { sel = null; fly = null; } };
} };
})();
