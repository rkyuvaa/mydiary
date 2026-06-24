import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getStore } = require('@netlify/blobs');

export default async (req: Request, context: any) => {
  // If NETLIFY_DEV is set in Netlify's production environment variables (e.g. by mistake),
  // it forces the SDK to look for local emulation. Deleting it allows production Blobs to work.
  if (process.env.NETLIFY_DEV && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    delete process.env.NETLIFY_DEV;
  }

  try {
    const store = getStore('diary-store');

    if (req.method === 'GET') {
      const data = await store.get('state');
      return new Response(data || JSON.stringify({ folders: [], entries: [], tasks: [] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else if (req.method === 'POST' || req.method === 'PATCH') {
      const bodyText = await req.text();
      await store.set('state', bodyText);
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
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
