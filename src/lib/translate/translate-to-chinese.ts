/** Google Cloud Translation API (v2, "Basic") — simple API-key auth, no service account needed. */
export async function translateToChinese(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_TRANSLATE_API_KEY is not set");
  }

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: "zh-CN", format: "text" }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Translate API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const translated = data?.data?.translations?.[0]?.translatedText;
  if (typeof translated !== "string") {
    throw new Error("Unexpected Google Translate API response shape");
  }

  return translated;
}
