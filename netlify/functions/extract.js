exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { text, provider } = JSON.parse(event.body);
  const aiProvider = provider || 'gemini';

  // Load API keys from Netlify Blobs state if stored
  let state = {};
  try {
    const { getStore } = require('@netlify/blobs');
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
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Gemini API key is not configured. Please enter it in Settings on the website or set GEMINI_API_KEY in your Netlify dashboard.' })
        };
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
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ raw })
      };
    } else {
      const key = process.env.CLAUDE_API_KEY || state.claudeKey;
      if (!key) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Claude API key is not configured. Please enter it in Settings on the website or set CLAUDE_API_KEY in your Netlify dashboard.' })
        };
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
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ raw })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: err.message })
    };
  }
};
