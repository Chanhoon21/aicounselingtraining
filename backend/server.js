const express = require('express');
const cors = require('cors');
const multer = require('multer');            // <-- for file upload
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;
const upload = multer();

// In-memory scenario storage (demo)
let scenarios = [
  {
    id: 1,
    title: 'Depression Counseling',
    scenario: 'Recent loss of motivation and sleep problems',
    clientBackground: '20s graduate student, academic stress and social withdrawal'
  },
  {
    id: 2,
    title: 'Anxiety Disorder Counseling',
    scenario: 'Severe anxiety before presentations',
    clientBackground: '30s male, workplace evaluation stress'
  },
  {
    id: 3,
    title: 'Relationship Issues Counseling',
    scenario: 'Interpersonal conflicts at workplace',
    clientBackground: '40s female, stress from conflicts with colleagues'
  }
];

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://aicounselingtraining.onrender.com'],
  credentials: true
}));

app.use(express.json());

// Ephemeral key (user must supply API key)
app.post('/api/get-ephemeral-key', async (req, res) => {
  try {
    const { scenario, clientBackground, apiKey } = req.body || {};

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        error: 'OpenAI API key is required. Please provide your OpenAI API key to use this service.'
      });
    }
    const OPENAI_KEY = apiKey.trim();

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03',
        voice: 'ballad'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API error:', response.status, data);
      return res.status(response.status).json({
        error: data?.error?.message || 'Failed to create session',
        details: data?.error || 'OpenAI API request failed'
      });
    }

    res.json({
      ephemeral_key: data.client_secret?.value,
      expires_at: data.client_secret?.expires_at,
      session_id: data.id
    });
  } catch (error) {
    console.error('Ephemeral key error:', error);
    res.status(500).json({
      error: 'Failed to mint ephemeral key',
      details: error.message
    });
  }
});

// Save scenario
app.post('/api/save-scenario', (req, res) => {
  try {
    const { title, scenario, clientBackground } = req.body || {};
    if (!title?.trim() || !scenario?.trim()) {
      return res.status(400).json({ error: 'title and scenario are required' });
    }
    const newScenario = {
      id: Date.now(),
      title: title.trim(),
      scenario: scenario.trim(),
      clientBackground: (clientBackground || '').trim()
    };
    scenarios.push(newScenario);
    res.json({
      success: true,
      message: '시나리오가 저장되었습니다.',
      scenario: newScenario
    });
  } catch (error) {
    console.error('Save scenario error:', error);
    res.status(500).json({ error: '시나리오 저장에 실패했습니다.' });
  }
});

// List scenarios
app.get('/api/scenarios', (req, res) => {
  try {
    res.json(scenarios);
  } catch (error) {
    console.error('List scenarios error:', error);
    res.status(500).json({ error: '시나리오 조회에 실패했습니다.' });
  }
});

// ---- Transcription (gpt-4o-mini-transcribe) ----
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { apiKey, language } = req.body || {};
    const OPENAI_KEY = (apiKey || '').trim();
    if (!OPENAI_KEY) return res.status(400).json({ error: 'API key required' });
    if (!req.file) return res.status(400).json({ error: 'audio is required' });

    // Node 18+ has Blob/FormData
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    const form = new FormData();
    form.append('file', blob, 'session.webm');
    form.append('model', 'gpt-4o-mini-transcribe');
    if (language && language !== 'auto') form.append('language', language);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: form
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Transcription error:', data);
      return res.status(r.status).json({ error: data?.error?.message || 'transcription failed' });
    }
    res.json({ text: data.text || '' });
  } catch (e) {
    console.error('Transcription exception:', e);
    res.status(500).json({ error: 'transcription failed' });
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI 상담 훈련 서버가 정상적으로 작동 중입니다.' });
});

app.listen(port, () => {
  console.log(`AI 상담 훈련 서버가 포트 ${port}에서 실행 중입니다.`);
});
