// Reads the text out of an uploaded card statement PDF and returns the parsed spend lines. The file lives in memory for this request only:
// it is never stored, and neither is its text. Card statements are usually password protected, so a password can be sent with the file.
import { extractText, getDocumentProxy } from 'unpdf';
import { allow } from '@/lib/claude';
import { clientKey, sameOrigin } from '@/lib/guard';
import { underDailyCap } from '@/lib/usage';
import cardsJson from '@/data/cards.json';
import { detectCard, parseStatementText } from '@/lib/statement';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX = 4 * 1024 * 1024; // the host caps request bodies at about 4.5 MB

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'This request came from another site.' }, { status: 403 });
  if (Number(req.headers.get('content-length') ?? 0) > MAX + 64 * 1024) return Response.json({ error: 'That PDF is over 4 MB. Paste the transactions instead.' }, { status: 413 });
  if (!allow(clientKey(req), 10) || !(await underDailyCap('pdf', clientKey(req), 80, 2000))) return Response.json({ error: 'Too many statements read. Try again later, or paste the transactions.' }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const password = String(form?.get('password') ?? '').slice(0, 100);
  if (!(file instanceof File)) return Response.json({ error: 'Choose a PDF statement.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'That PDF is over 4 MB. Paste the transactions instead.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return Response.json({ error: 'That file is not a PDF.' }, { status: 415 });

  try {
    const pdf = await getDocumentProxy(bytes, password ? { password } : {});
    if (pdf.numPages > 40) return Response.json({ error: 'That PDF has too many pages for a card statement. Paste the transactions instead.' }, { status: 422 });
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const parsed = parseStatementText(text);
    if (!parsed.txns.length) return Response.json({ error: 'We read the PDF but found no transactions. Paste them instead.', pages: totalPages }, { status: 422 });
    return Response.json({ ...parsed, ...detectCard(text, cardsJson.cards as { id: string; bank: string; name: string }[]), pages: totalPages });
  } catch (e) {
    const name = (e as { name?: string }).name ?? '';
    if (name === 'PasswordException') {
      const wrong = (e as { code?: number }).code === 2;
      return Response.json({ error: wrong ? 'That password did not open the PDF.' : 'This PDF is password protected. Enter its password.', needsPassword: true }, { status: 401 });
    }
    return Response.json({ error: 'We could not read that PDF. Paste the transactions instead.' }, { status: 422 });
  }
}
