const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Create or retrieve the store named 'diary-store'
  const store = getStore({
    name: 'diary-store',
    // Netlify Blobs automatically links deploy credentials when running in production.
  });

  try {
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
