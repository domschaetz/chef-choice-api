// Image upload endpoint for iOS compatibility - using Firebase REST API
app.post('/upload-image', async (req, res) => {
  console.log('📷 Received image upload request');
  
  const { imageData, fileName, contentType, userId, recipeId } = req.body;

  // Validate request
  if (!imageData || !fileName || !contentType || !userId) {
    return res.status(400).json({ error: 'Missing required fields: imageData, fileName, contentType, userId' });
  }

  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData, 'base64');
    console.log('📁 Image buffer size:', imageBuffer.length);

    // Generate upload path
    const timestamp = Date.now();
    const uploadPath = `recipes/${userId}/${recipeId || timestamp}_${fileName}`;
    console.log('📤 Upload path:', uploadPath);

    // Use Firebase Storage REST API directly (bypassing Admin SDK auth issues)
    const bucketName = 'chef-choice-60cc3.firebasestorage.app';
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(uploadPath)}`;
    
    console.log('🌐 Making direct API call to:', uploadUrl);

    // Make direct HTTP request to Firebase Storage
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: imageBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firebase API error:', response.status, errorText);
      throw new Error(`Firebase upload failed: ${response.status} ${errorText}`);
    }

    const uploadResult = await response.json();
    console.log('✅ File uploaded successfully:', uploadResult.name);

    // Get the download URL
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(uploadResult.name)}?alt=media`;
    
    console.log('🔗 Download URL:', downloadURL);

    res.json({
      success: true,
      downloadURL: downloadURL,
      uploadPath: uploadResult.name
    });

  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + error.message });
  }
});