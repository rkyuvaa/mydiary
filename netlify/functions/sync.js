const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // If NETLIFY_DEV is set in Netlify's production environment variables (e.g. by mistake),
  // it forces the SDK to look for local emulation. Deleting it allows production Blobs to work.
  if (process.env.NETLIFY_DEV && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    delete process.env.NETLIFY_DEV;
  }

  try {
    // Create or retrieve the store named 'diary-store'
    const store = getStore('diary-store');
    if (event.httpMethod === 'GET') {
      const data = await store.get('state');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: data || JSON.stringify({ folders: [], entries: [], tasks: [] })
      };
    } else if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH') {
      await store.set('state', event.body);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: true })
      };
    } else if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
        },
        body: ''
      };
    } else {
      return { statusCode: 405, body: 'Method Not Allowed' };
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
