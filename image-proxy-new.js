// Image proxy endpoint for authenticated image loading
app.post('/image-proxy', async (req, res) => {
  console.log('🖼️ === IMAGE PROXY REQUEST START ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Basic API key authentication
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET_KEY || 'chef-choice-mobile-app-2025';

  if (apiKey !== expectedApiKey) {
    console.log('🚫 Unauthorized API access attempt', { received: apiKey, expected: expectedApiKey });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { storagePath, authToken } = req.body;

  // Validate request
  if (!storagePath || !authToken) {
    console.log('❌ Missing required fields:', { storagePath: !!storagePath, authToken: !!authToken });
    return res.status(400).json({ error: 'Missing storagePath or authToken' });
  }

  console.log('🖼️ Proxying authenticated image request for path:', storagePath);
  console.log('🔑 Auth token preview:', authToken.substring(0, 20) + '...');

  try {
    // Use Firebase Storage REST API directly with the user's auth token
    // This avoids the need for Firebase Admin SDK service account credentials
    
    console.log('🔗 Building Firebase Storage REST API URL...');
    const encodedPath = encodeURIComponent(storagePath);
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/chef-choice-60cc3.firebasestorage.app/o/${encodedPath}?alt=media`;
    console.log('📡 Storage URL:', storageUrl);

    console.log('📤 Making authenticated request to Firebase Storage...');
    const storageResponse = await fetch(storageUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': '*/*'
      }
    });

    console.log('📥 Firebase Storage response status:', storageResponse.status);
    console.log('📥 Firebase Storage response headers:', [...storageResponse.headers.entries()]);

    if (!storageResponse.ok) {
      const errorText = await storageResponse.text();
      console.log('❌ Firebase Storage error response:', errorText);
      
      if (storageResponse.status === 401) {
        return res.status(401).json({ error: 'Authentication failed' });
      } else if (storageResponse.status === 403) {
        return res.status(403).json({ error: 'Access denied to this file' });
      } else if (storageResponse.status === 404) {
        return res.status(404).json({ error: 'Image not found' });
      } else {
        return res.status(storageResponse.status).json({ error: `Firebase Storage error: ${errorText}` });
      }
    }

    // Get content type from Firebase Storage response
    const contentType = storageResponse.headers.get('content-type') || 'image/jpeg';
    const contentLength = storageResponse.headers.get('content-length');
    
    console.log('📋 Image metadata from Firebase:', {
      contentType,
      contentLength,
      status: storageResponse.status
    });

    // Set appropriate headers
    res.set('Content-Type', contentType);
    if (contentLength) {
      res.set('Content-Length', contentLength);
    }
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    console.log('📤 Streaming image data from Firebase Storage...');
    
    // Stream the response body to the client
    if (storageResponse.body) {
      storageResponse.body.pipe(res);
      console.log('✅ Successfully started streaming image');
    } else {
      // Fallback for older Node.js versions
      const buffer = await storageResponse.buffer();
      res.send(buffer);
      console.log('✅ Successfully sent image buffer, size:', buffer.length);
    }

  } catch (error) {
    console.error('❌ Image proxy error - Full details:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy image: ' + error.message });
    }
  }
  
  console.log('🖼️ === IMAGE PROXY REQUEST END ===');
});