import { Categories, Priorities } from '../utils/constants';
import { sanitizeInput } from '../utils/errors';

interface AICategorizationResult {
  category: string;
  priority: string;
  summary: string;
  confidence: number;
}

const DEFAULT_RESULT: AICategorizationResult = {
  category: 'Other',
  priority: 'Medium',
  summary: 'Issue requires manual categorization by the support team.',
  confidence: 0.25,
};

const cache = new Map<string, { value: AICategorizationResult; expiresAt: number }>();
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS || 60 * 60 * 1000);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJSONResult = (content: string): Partial<AICategorizationResult> => {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return {};
    }

    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      return {};
    }
  }
};

const normalizeResult = (result: Partial<AICategorizationResult>): AICategorizationResult => {
  const category = Categories.includes(result.category || '') ? result.category! : DEFAULT_RESULT.category;
  const priority = Priorities.includes(result.priority || '') ? result.priority! : DEFAULT_RESULT.priority;
  const summary = sanitizeInput(result.summary || '').slice(0, 240) || DEFAULT_RESULT.summary;

  return {
    category,
    priority,
    summary,
    confidence: typeof result.confidence === 'number' ? Math.min(Math.max(result.confidence, 0), 1) : 0.7,
  };
};

const cacheKeyFor = (title: string, description: string) =>
  `${title.trim().toLowerCase()}::${description.trim().toLowerCase()}`;

export const categorizeTicketWithAI = async (title: string, description: string): Promise<AICategorizationResult> => {
  const key = cacheKeyFor(title, description);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    cache.set(key, { value: DEFAULT_RESULT, expiresAt: Date.now() + CACHE_TTL_MS });
    return DEFAULT_RESULT;
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You classify IT support tickets. Return strict JSON with keys category, priority, summary, confidence. Category must be one of the provided categories. Priority must be one of Critical, High, Medium, Low. Summary must be 1-2 concise sentences.',
            },
            {
              role: 'user',
              content: `Categories: ${Categories.join(', ')}\n\nTitle: ${title}\nDescription: ${description}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content || typeof content !== 'string') {
        throw new Error('AI response did not contain parsable content');
      }

      const normalized = normalizeResult(parseJSONResult(content));
      cache.set(key, { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS });
      return normalized;
    } catch {
      if (attempt === maxAttempts) {
        console.error('AI categorization failed after retries');
        break;
      }

      await delay(2 ** (attempt - 1) * 500);
    }
  }

  cache.set(key, { value: DEFAULT_RESULT, expiresAt: Date.now() + CACHE_TTL_MS });
  return DEFAULT_RESULT;
};
