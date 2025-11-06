// =======================
// 📦 Imports
// =======================
require('dotenv').config(); // LOAD .env FILE FIRST
const express = require('express');
const path = require('path');
// Note: fetch is global in modern Node.js, so no 'node-fetch' import needed.

// =======================
// ⚙️ Setup
// =======================
const app = express();
const PORT = process.env.PORT || 3000;

// =======================
// 🔐 API KEYS (SECURE)
// =======================
const clientId = process.env.JDOODLE_CLIENT_ID;
const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!clientId || !clientSecret || !GEMINI_API_KEY) {
  console.error('❌ FATAL ERROR: Missing API keys in .env file.');
}

// =======================
// 🧱 Middleware
// =======================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// 💻 JDoodle Java Runner
// =======================
app.post('/run-java', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No Java code provided' });
  }

  try {
    const jdoodleResponse = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: code,
        language: 'java',
        versionIndex: '4',
        clientId,
        clientSecret,
      }),
    });

    const responseJson = await jdoodleResponse.json();
    res.json(responseJson);
  } catch (err) {
    console.error('❌ Error calling JDoodle API:', err);
    res.status(500).json({ error: 'Failed to call JDoodle API' });
  }
});

// =======================
// 🤖 Gemini AI Doubt Solver
// =======================
app.post('/ask-gemini', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'No question provided' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: question }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API Error:', errorText);
      return res.status(500).json({ error: 'Gemini API Error', details: errorText });
    }

    const data = await response.json();

    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '⚠ No response from Gemini AI.';

    res.json({ answer });
  } catch (error) {
    console.error('❌ Error contacting Gemini API:', error);
    res.status(500).json({ error: 'Failed to contact Gemini API' });
  }
});

// ==================================
// 🎨 NEW: Gemini Image/Text Generator
// ==================================
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
              parts: [{ text: prompt }]
          }],
          generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini Image API Error:', errorText);
      if (response.status === 403) {
          return res.status(403).json({ error: 'API Key does not have permission. Please enable the "Vertex AI API" in your Google Cloud project.', details: errorText });
      }
      if (response.status === 429) {
          return res.status(429).json({ error: 'Too many requests. Please wait and try again.', details: errorText });
      }
      return res.status(response.status).json({ error: 'Gemini Image API Error', details: errorText });
    }

    const data = await response.json();
    res.json(data); 

  } catch (error) {
    console.error('❌ Error contacting Gemini Image API:', error);
    res.status(500).json({ error: 'Failed to contact Gemini Image API' });
  }
});


// =======================
// ✅ ✅ ✅ OLLAMA BACKEND ADDED HERE
// =======================

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

// Send single message to Ollama (like ChatGPT)
app.post('/ask-ollama', async (req, res) => {
  const { prompt, model = "phi3" } = req.body;

  if (!prompt) return res.status(400).json({ error: "No prompt provided" });

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });

    const data = await response.json();
    res.json({ answer: data.response });
  } catch (error) {
    console.error("❌ Ollama Error:", error);
    res.status(500).json({ error: "Failed to contact Ollama" });
  }
});


// =======================
// 🌐 Fallback (Frontend Routing)
// =======================
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =======================
// 🚀 Start Server
// =======================
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
