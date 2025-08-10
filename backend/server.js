const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// In-memory scenario storage
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

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'https://aicounselingtraining.onrender.com'],
  credentials: true
}));

app.use(express.json());

// 에피메랄 키 생성 엔드포인트
app.post('/api/get-ephemeral-key', async (req, res) => {
  try {
    const { scenario, clientBackground, apiKey } = req.body || {};

    // 사용자가 반드시 API 키를 제공해야 함
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
        voice: 'ballad' // More expressive voice with greater emotional range
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API 오류:', response.status, data);
      return res.status(response.status).json({ 
        error: data?.error?.message || 'Failed to create session',
        details: data?.error || 'OpenAI API request failed'
      });
    }

    // 브라우저에는 에피메랄 토큰 정보만 반환
    res.json({
      ephemeral_key: data.client_secret?.value,
      expires_at: data.client_secret?.expires_at,
      session_id: data.id
    });
  } catch (error) {
    console.error('에피메랄 키 생성 오류:', error);
    res.status(500).json({ 
      error: 'Failed to mint ephemeral key',
      details: error.message 
    });
  }
});

// 시나리오 저장 엔드포인트
app.post('/api/save-scenario', (req, res) => {
  try {
    const { title, scenario, clientBackground } = req.body || {};
    
    if (!title?.trim() || !scenario?.trim()) {
      return res.status(400).json({ error: 'title and scenario are required' });
    }
    
    const newScenario = {
      id: Date.now(), // 간단한 ID 생성
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
    console.error('시나리오 저장 오류:', error);
    res.status(500).json({ error: '시나리오 저장에 실패했습니다.' });
  }
});

// 저장된 시나리오 목록 조회
app.get('/api/scenarios', (req, res) => {
  try {
    res.json(scenarios);
  } catch (error) {
    console.error('시나리오 조회 오류:', error);
    res.status(500).json({ error: '시나리오 조회에 실패했습니다.' });
  }
});

// 서버 상태 확인
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI 상담 훈련 서버가 정상적으로 작동 중입니다.' });
});

app.listen(port, () => {
  console.log(`AI 상담 훈련 서버가 포트 ${port}에서 실행 중입니다.`);
});
