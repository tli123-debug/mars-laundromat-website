/**
 * Anthropic Claude Haiku 4.5 — replaces the Google Cloud Translation API
 * (confirmed unavailable). Same signature/contract as before: throws on any
 * failure, letting the caller's try/catch fall back to a null translation
 * without ever blocking booking creation. A short timeout is deliberate — a
 * translation-provider outage shouldn't make a customer wait long for their
 * booking to save.
 */
const REQUEST_TIMEOUT_MS = 4000;

export async function translateToChinese(text: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          "You are a translation engine. Translate the user's message into Simplified Chinese. " +
          "Reply with only the translation — no preamble, no quotes, no explanation.",
        messages: [{ role: "user", content: text }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const translated = data?.content?.[0]?.text;
    if (typeof translated !== "string") {
      throw new Error("Unexpected Claude API response shape");
    }

    return translated.trim();
  } finally {
    clearTimeout(timeout);
  }
}
