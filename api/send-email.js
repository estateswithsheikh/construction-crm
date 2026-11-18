// Email a quote or invoice to a client through Resend, with the PDF attached.
import { env, handler, requireUser, HttpError, isEmail } from './_lib.js';

export default handler(async (req) => {
  const { profile } = await requireUser(req);
  const key = env('RESEND_API_KEY');
  if (!key) throw new HttpError(503, 'Email isn\'t set up yet. Add RESEND_API_KEY in Vercel.', 'not_configured');

  const b = req.body || {};
  const to = String(b.to || '').trim(), cc = b.cc ? String(b.cc).trim() : '';
  if (!isEmail(to)) throw new HttpError(400, 'Enter a valid client email address.', 'bad_request');
  if (cc && !isEmail(cc)) throw new HttpError(400, 'The CC address isn\'t valid.', 'bad_request');
  const subject = String(b.subject || '').trim().slice(0, 200);
  const text = String(b.text || '').slice(0, 20000);
  if (!subject || !text) throw new HttpError(400, 'Add a subject and a message.', 'bad_request');

  const attachments = [];
  if (b.attachment) {
    const { filename, content } = b.attachment;
    if (typeof content !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(content) || content.length > 4_000_000) throw new HttpError(400, 'The PDF attachment is invalid or too large.', 'bad_request');
    attachments.push({ filename: String(filename || 'document.pdf').replace(/[^\w.\- ]+/g, '').slice(0, 80) || 'document.pdf', content });
  }

  // From: a verified sender on your domain (EMAIL_FROM), shown with the company name.
  const fromAddr = env('EMAIL_FROM') || 'onboarding@resend.dev';
  const fromName = String(b.fromName || '').replace(/[<>"\r\n]/g, '').slice(0, 80);
  const from = /</.test(fromAddr) ? fromAddr : fromName ? `${fromName} <${fromAddr}>` : fromAddr;
  const replyTo = isEmail(b.replyTo) ? b.replyTo : isEmail(profile.email) ? profile.email : undefined;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16181d;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], ...(cc ? { cc: [cc] } : {}), ...(replyTo ? { reply_to: replyTo } : {}), subject, text, html, attachments })
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('resend', r.status, out);
    const msg = out && out.message ? out.message : 'The email service rejected the message.';
    throw new HttpError(r.status === 429 ? 429 : 502, /domain|verify/i.test(msg) ? `${msg} (Check EMAIL_FROM uses a domain verified in Resend.)` : msg, 'email_failed');
  }
  return { id: out.id };
});
