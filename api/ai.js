// Claude proxy for the AI quote drafter, text polish and the AI assistant.
// The browser runs the tool loop (its tools read CRM data it already has); this function only holds the API key.
import Anthropic from '@anthropic-ai/sdk';
import { env, handler, requireUser, HttpError } from './_lib.js';

const MODEL = env('ANTHROPIC_MODEL') || 'claude-opus-5-5';

export default handler(async (req) => {
  await requireUser(req);
  if (!env('ANTHROPIC_API_KEY')) throw new HttpError(503, 'AI isn\'t set up yet. Add ANTHROPIC_API_KEY in Vercel.', 'not_configured');
  const b = req.body || {};
  if (!Array.isArray(b.messages) || !b.messages.length || b.messages.length > 40) throw new HttpError(400, 'Bad request.', 'bad_request');
  const body = JSON.stringify(b.messages);
  if (body.length > 400_000) throw new HttpError(413, 'That conversation is too long. Start a new one.', 'too_large');

  const tools = Array.isArray(b.tools) ? b.tools.slice(0, 10).map((t) => ({ name: String(t.name), description: String(t.description || ''), input_schema: t.input_schema || { type: 'object', properties: {} } })) : [];
  const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') });
  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on a suitable model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      ...(typeof b.system === 'string' && b.system ? { system: b.system.slice(0, 4000) } : {}),
      ...(tools.length ? { tools } : {}),
      messages: b.messages
    });
    return { content: msg.content, stop_reason: msg.stop_reason, model: msg.model };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, 'The AI is busy. Try again in a minute.', 'rate_limited');
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError(502, 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.', 'ai_auth');
    if (e instanceof Anthropic.BadRequestError) { console.error('ai 400', e.message); throw new HttpError(400, 'The AI couldn\'t process that request.', 'bad_request'); }
    if (e instanceof Anthropic.APIError) { console.error('ai', e.status, e.message); throw new HttpError(502, 'The AI service had a problem. Try again.', 'ai_error'); }
    throw e;
  }
});
