const express = require('express');
const cors = require('cors');
const multer = require('multer');            // for file upload
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;
const upload = multer();

// In-memory scenario storage with user separation
let scenarios = [
  {
    id: 1,
    title: 'Depression Counseling',
    scenario: 'Recent loss of motivation and sleep problems',
    clientBackground: '20s graduate student, academic stress and social withdrawal',
    userId: 'default' // 기본 시나리오는 모든 사용자가 볼 수 있음
  },
  {
    id: 2,
    title: 'Anxiety Disorder Counseling',
    scenario: 'Severe anxiety before presentations',
    clientBackground: '30s male, workplace evaluation stress',
    userId: 'default'
  },
  {
    id: 3,
    title: 'Relationship Issues Counseling',
    scenario: 'Interpersonal conflicts at workplace',
    clientBackground: '40s female, stress from conflicts with colleagues',
    userId: 'default'
  }
];

// 사용자별 시나리오 저장소
let userScenarios = {};

// 사용자 ID 생성 함수
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://aicounselingtraining.onrender.com'],
  credentials: true
}));

app.use(express.json());

// 사용자 ID 생성 엔드포인트
app.post('/api/create-user', (req, res) => {
  try {
    const userId = generateUserId();
    userScenarios[userId] = [];
    res.json({ 
      success: true, 
      userId: userId,
      message: '새 사용자가 생성되었습니다.'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: '사용자 생성에 실패했습니다.' });
  }
});

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
        // (Optional) You can also inject the same role-contract instructions here if you want redundancy.
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

// Save scenario (사용자별로 저장)
app.post('/api/save-scenario', (req, res) => {
  try {
    const { title, scenario, clientBackground, userId } = req.body || {};
    if (!title?.trim() || !scenario?.trim()) {
      return res.status(400).json({ error: 'title and scenario are required' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const newScenario = {
      id: Date.now(),
      title: title.trim(),
      scenario: scenario.trim(),
      clientBackground: (clientBackground || '').trim(),
      userId: userId
    };

    // 사용자별 시나리오 배열에 추가
    if (!userScenarios[userId]) {
      userScenarios[userId] = [];
    }
    userScenarios[userId].push(newScenario);

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

// List scenarios (사용자별로 조회)
app.get('/api/scenarios', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      // 기본 시나리오만 반환
      const defaultScenarios = scenarios.filter(s => s.userId === 'default');
      res.json(defaultScenarios);
      return;
    }

    // 기본 시나리오 + 사용자별 시나리오 반환
    const defaultScenarios = scenarios.filter(s => s.userId === 'default');
    const userSpecificScenarios = userScenarios[userId] || [];
    const allScenarios = [...defaultScenarios, ...userSpecificScenarios];
    
    res.json(allScenarios);
  } catch (error) {
    console.error('List scenarios error:', error);
    res.status(500).json({ error: '시나리오 조회에 실패했습니다.' });
  }
});

// 사용자별 시나리오 삭제
app.delete('/api/scenarios/:scenarioId', (req, res) => {
  try {
    const { scenarioId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!userScenarios[userId]) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const scenarioIndex = userScenarios[userId].findIndex(s => s.id == scenarioId);
    if (scenarioIndex === -1) {
      return res.status(404).json({ error: '시나리오를 찾을 수 없습니다.' });
    }

    const deletedScenario = userScenarios[userId].splice(scenarioIndex, 1)[0];
    res.json({
      success: true,
      message: '시나리오가 삭제되었습니다.',
      scenario: deletedScenario
    });
  } catch (error) {
    console.error('Delete scenario error:', error);
    res.status(500).json({ error: '시나리오 삭제에 실패했습니다.' });
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

// ---- Dual Transcription (labeled counselor/client) ----
app.post('/api/transcribe-dual', upload.fields([
  { name: 'audio_mic', maxCount: 1 },
  { name: 'audio_ai',  maxCount: 1 }
]), async (req, res) => {
  try {
    const OPENAI_KEY = (req.body.apiKey || '').trim();
    const language = req.body.language;
    if (!OPENAI_KEY) return res.status(400).json({ error: 'API key required' });

    const micFile = req.files?.audio_mic?.[0];
    const aiFile  = req.files?.audio_ai?.[0];
    if (!micFile || !aiFile) return res.status(400).json({ error: 'audio_mic and audio_ai are required' });

    const transcribeOne = async (file) => {
      const blob = new Blob([file.buffer], { type: file.mimetype || 'audio/webm' });
      const form = new FormData();
      form.append('file', blob, file.originalname || 'audio.webm');
      form.append('model', 'gpt-4o-mini-transcribe');
      if (language && language !== 'auto') form.append('language', language);

      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: form
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || 'transcription failed');
      return data.text || '';
    };

    const [counselorText, clientText] = await Promise.all([
      transcribeOne(micFile),
      transcribeOne(aiFile)
    ]);

    res.json({
      counselor: counselorText,
      client: clientText
    });
  } catch (e) {
    console.error('transcribe-dual error:', e);
    res.status(500).json({ error: 'dual transcription failed' });
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI 상담 훈련 서버가 정상적으로 작동 중입니다.' });
});

app.listen(port, () => {
  console.log(`AI 상담 훈련 서버가 포트 ${port}에서 실행 중입니다.`);
});
