/**
 * Optional Gemini hook. The demo MUST work without a key — see `hasGeminiKey`.
 * When a key is set (VITE_GEMINI_API_KEY), `explainWithGemini` asks Gemini to
 * justify an agreed split in plain words. The reply is returned as text and
 * the UI labels it "Gemini-generated". It never changes the split, the
 * congestion numbers, or any Insight — those come from the rule engine.
 */

const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export function hasGeminiKey(): boolean {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return Boolean(key && key.trim().length > 0);
}

export async function explainWithGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) throw new Error('No Gemini API key configured (VITE_GEMINI_API_KEY).');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini API returned ${res.status}.`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim();
    if (!text) throw new Error('Gemini returned an empty reply.');
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}
