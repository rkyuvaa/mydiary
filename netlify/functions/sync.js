import { getStore } from '@netlify/blobs';

const withTimeout = (promise, timeoutMs = 3000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Storage request timed out. Please check if Netlify Blobs is enabled for your site.')), timeoutMs))
  ]);
};

export default async (req, context) => {
  // If NETLIFY_DEV is set in Netlify's production environment variables (e.g. by mistake),
  // it forces the SDK to look for local emulation. Deleting it allows production Blobs to work.
  if (process.env.NETLIFY_DEV && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    delete process.env.NETLIFY_DEV;
  }

  try {
    const store = getStore('diary-store');

    if (req.method === 'GET') {
      const data = await withTimeout(store.get('state'));
      return new Response(data || JSON.stringify({ folders: [], entries: [], tasks: [] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else if (req.method === 'POST' || req.method === 'PATCH') {
      const bodyText = await req.text();
      await withTimeout(store.set('state', bodyText));
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else if (req.method === 'OPTIONS') {
      return new Response('', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
        }
      });
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (err) {
    console.error('Sync function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
