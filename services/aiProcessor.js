const Anthropic = require('@anthropic-ai/sdk');

const SAFE_DEFAULT = {
  summary: null,
  date: null,
  key_quote: null,
  tags: [],
  reading_time: null,
  tone: null,
  highlights: [],
  occasion: null,
  category: null
};

/**
 * Send extracted PDF text to Claude and return structured metadata.
 * @param {string} text    — Plain text extracted from the PDF
 * @param {string} contentType — "pastoral_letter", "homily", or "writing"
 * @returns {object} Metadata object (always returns, never throws)
 */
async function processDocument(text, contentType) {
  if (!text || !text.trim()) {
    return { ...SAFE_DEFAULT };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('AI Processor: ANTHROPIC_API_KEY not set, skipping AI processing.');
    return { ...SAFE_DEFAULT };
  }

  /* Truncate extremely long documents to stay within token limits */
  const maxChars = 80000;
  const truncatedText = text.length > maxChars
    ? text.substring(0, maxChars) + '\n\n[Document truncated for processing]'
    : text;

  const systemPrompt = `You are an assistant helping catalog official Catholic church documents for Archbishop Valerian Okeke. Analyze the document text and return ONLY a valid JSON object with no markdown, no explanation, and no extra text.

Return these fields:
- summary: A clear, dignified 2-3 sentence summary
- date: Publication or delivery date found in document (format: YYYY-MM-DD). Return null if not found
- key_quote: The single most powerful or meaningful sentence from the document
- tags: Array of 3-5 relevant keyword strings
- reading_time: Estimated reading time as a string e.g. "6 mins"
- tone: One word describing the tone — Reflective, Instructional, Celebratory, Pastoral, or Urgent
- highlights: Array of exactly 3 key points from the document
- occasion: For homilies only — the occasion this homily was delivered at. Return null for other types
- category: For writings only — category such as Reflection, Article, Speech, Letter. Return null for other types`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this ${contentType.replace('_', ' ')} document and return the JSON metadata:\n\n${truncatedText}`
        }
      ]
    });

    const responseText = response.content[0].text.trim();

    /* Strip any accidental markdown fencing */
    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    /* Ensure all expected fields exist */
    return {
      summary: parsed.summary || null,
      date: parsed.date || null,
      key_quote: parsed.key_quote || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      reading_time: parsed.reading_time || null,
      tone: parsed.tone || null,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      occasion: parsed.occasion || null,
      category: parsed.category || null
    };
  } catch (err) {
    console.error('AI Processor error:', err.message);
    return { ...SAFE_DEFAULT };
  }
}

module.exports = { processDocument };
