// Shared by the two sign-in code routes. Server only.
import { createHmac } from 'node:crypto';

// No 0/O/1/I/L so a code read off a phone is hard to mistype.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

export const hashCode = (email: string, code: string) => createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()).update(`${email}|${code}`).digest('hex');
