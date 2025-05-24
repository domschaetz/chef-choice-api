import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

dotenv.config();

// Initialize Firebase Admin SDK with simplified approach
// For development, we'll use the default credentials or application default credentials
try {
  admin.initializeApp({
    projectId: "chef-choice-60cc3",
    storageBucket: "chef-choice-60cc3.firebasestorage.app"
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
}

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
  const expectedApiKey = process.env.API_SECRET_KEY || 'chef-choice-mobile-app-2025';

  if (apiKey !== expectedApiKey) {
    console.log('🚫 Unauthorized API access attempt', { received: apiKey, expected: expectedApiKey });
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
          content: 'You are a recipe extractor. Extract structured recipe data as JSON with this exact format: {"title": "Recipe Name", "ingredientsByProcessingStep": [{"name": "Ingredients", "items": [{"quantity": "1 cup", "name": "flour"}]}], "steps": "Mix ingredients in a bowl. Heat pan and cook until done.", "tags": ["dinner", "easy"]}',
        },
        {
          role: 'user',
          content: `Extract the recipe from this text as JSON with the exact format specified:\n\n${text}`,
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

// URL parsing endpoint
app.post('/parse-url', async (req, res) => {
  // Basic API key authentication
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET_KEY || 'chef-choice-mobile-app-2025';

  if (apiKey !== expectedApiKey) {
    console.log('🚫 Unauthorized API access attempt', { received: apiKey, expected: expectedApiKey });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url } = req.body;

  // Validate request
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Invalid request: url is required' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  console.log('🌐 Fetching recipe from URL:', url);

  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Chef-Choice-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('📄 Fetched HTML length:', html.length);

    // Extract text content from HTML (basic extraction)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit text for processing
    const limitedText = textContent.substring(0, 4000);
    console.log('📝 Extracted text preview:', limitedText.substring(0, 200));

    // Use OpenAI to parse the recipe
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a recipe extractor. Extract structured recipe data as JSON with this exact format: {"title": "Recipe Name", "ingredientsByProcessingStep": [{"name": "Ingredients", "items": [{"quantity": "1 cup", "name": "flour"}]}], "steps": "Mix ingredients in a bowl. Heat pan and cook until done.", "tags": ["dinner", "easy"]}',
        },
        {
          role: 'user',
          content: `Extract the recipe from this webpage text as JSON with the exact format specified:\n\n${limitedText}`,
        }
      ],
      temperature: 0.4,
    });

    const result = completion.choices[0].message.content;
    console.log('🧠 AI parsed URL result:', result);

    // Parse and validate the JSON
    let parsedResult;
    try {
      parsedResult = JSON.parse(result);
      console.log('✅ Parsed JSON successfully:', JSON.stringify(parsedResult, null, 2));
    } catch (e) {
      console.log('❌ JSON parsing failed, using fallback:', e.message);
      // If JSON parsing fails, return the raw result
      parsedResult = { title: 'Imported Recipe', steps: result, ingredientsByProcessingStep: [], tags: [] };
    }

    res.json(parsedResult);
  } catch (err) {
    console.error('❌ URL parsing error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch or parse recipe from URL: ' + (err.message || 'Unknown error') });
  }
});

// Image upload endpoint for iOS compatibility
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

    // Get Firebase Storage bucket
    const bucket = admin.storage().bucket();
    const file = bucket.file(uploadPath);

    // Upload the file
    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    console.log('✅ File uploaded successfully');

    // Make the file publicly readable
    await file.makePublic();
    console.log('🌐 File made public');

    // Get the download URL
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${uploadPath}`;

    console.log('🔗 Download URL:', downloadURL);

    res.json({
      success: true,
      downloadURL: downloadURL,
      uploadPath: uploadPath
    });

  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chef Choice API listening on port ${PORT}`);
});