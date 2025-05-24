import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS configuration for mobile apps
app.use(cors({
  origin: '*', // Allow all origins for mobile compatibility
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-API-Key'],
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Chef Choice Recipe Parser API',
    timestamp: new Date().toISOString()
  });
});

// Recipe parsing endpoint with enhanced security
app.post('/parse-recipe', async (req, res) => {
  // Basic API key authentication
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET_KEY;

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    console.log('🚫 Unauthorized API access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text } = req.body;

  // Validate request
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid request: text is required' });
  }

  // Rate limiting: max 5000 characters
  if (text.length > 5000) {
    return res.status(400).json({ error: 'Text too long. Maximum 5000 characters allowed.' });
  }

  console.log('📥 Received text for parsing:', text.slice(0, 100)); // preview first 100 chars

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a recipe extractor. Given plain text, extract structured recipe data as JSON.',
        },
        {
          role: 'user',
          content: `Extract this recipe as JSON with title, ingredients (with quantity and name), steps, and tags:\n\n${text}`,
        }
      ],
      temperature: 0.4,
    });

    const result = completion.choices[0].message.content;
    console.log('🧠 AI parsed result:', result);
    res.json({ result });
  } catch (err) {
    console.error('❌ OpenAI error:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'OpenAI API error' });
  }
});

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chef Choice API listening on port ${PORT}`);
});