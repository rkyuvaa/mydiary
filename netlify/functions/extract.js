const { getStore } = require('@netlify/blobs');

module.exports = async (req, context) => {
  // If NETLIFY_DEV is set in Netlify's production environment variables (e.g. by mistake),
  // it forces the SDK to look for local emulation. Deleting it allows production Blobs to work.
  if (process.env.NETLIFY_DEV && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    delete process.env.NETLIFY_DEV;
  }

  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { text, provider } = await req.json();
  const aiProvider = provider || 'gemini';

  // Load API keys from Netlify Blobs state if stored
  let state = {};
  try {
    const store = getStore('diary-store');
    const rawState = await store.get('state');
    if (rawState) {
      state = JSON.parse(rawState);
    }
  } catch (e) {
    console.error('Error fetching state from Netlify Blobs:', e);
  }

  try {
    if (aiProvider === 'gemini') {
      const key = process.env.GEMINI_API_KEY || state.geminiKey;
      if (!key) {
        return new Response(JSON.stringify({ error: 'Gemini API key is not configured. Please enter it in Settings on the website or set GEMINI_API_KEY in your Netlify dashboard.' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Extract tasks from this diary entry:\n\n' + text }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  tag: { type: 'STRING', enum: ['TASK', 'REMINDER', 'WAITING', 'SOMEDAY'] },
                  date: { type: 'STRING', nullable: true }
                },
                required: ['text', 'tag', 'date']
              }
            }
          }
        })
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return new Response(JSON.stringify({ raw }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      const key = process.env.CLAUDE_API_KEY || state.claudeKey;
      if (!key) {
        return new Response(JSON.stringify({ error: 'Claude API key is not configured. Please enter it in Settings on the website or set CLAUDE_API_KEY in your Netlify dashboard.' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1024,
          system: 'You are a task extraction assistant. Extract actionable items from a diary entry and return ONLY a valid JSON array with no extra text. Each item: {"text":string,"tag":"TASK"|"REMINDER"|"WAITING"|"SOMEDAY","date":string|null}. date is ISO date if mentioned, else null.',
          messages: [{ role: 'user', content: 'Extract tasks from this diary entry:\n\n' + text }]
        })
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = (data.content?.[0]?.text || '[]').replace(/```json?/g, '').replace(/```/g, '').trim();
      return new Response(JSON.stringify({ raw }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
