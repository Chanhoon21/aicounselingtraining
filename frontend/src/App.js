import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Mic,
  MicOff,
  PlayArrow,
  Stop,
  Settings,
  Psychology,
  VolumeUp
} from '@mui/icons-material';
import { webrtcManager } from './utils/webrtc';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

function App() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [ephemeralKey, setEphemeralKey] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [customScenario, setCustomScenario] = useState({
    title: '',
    scenario: '',
    clientBackground: ''
  });
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [userApiKey, setUserApiKey] = useState('');

  // 시나리오 목록 로드
  useEffect(() => {
    fetchScenarios();
  }, []);

  // WebRTC 연결 상태 모니터링
  useEffect(() => {
    webrtcManager.onConnectionStateChange = (state) => {
      setConnectionState(state);
      if (state === 'connected') {
        setIsConnected(true);
        showSnackbar('Connected to AI client.', 'success');
      } else if (state === 'disconnected') {
        setIsConnected(false);
        setIsRecording(false);
      }
    };

    webrtcManager.onTrack = (event) => {
      console.log('AI 응답 수신:', event);
    };

    webrtcManager.onMessage = (data) => {
      console.log('Realtime API 메시지:', data);
    };

    return () => {
      webrtcManager.stopConnection();
    };
  }, []);

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const fetchScenarios = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/scenarios`);
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error('Scenario load error:', error);
      showSnackbar('Failed to load scenarios.', 'error');
    }
  };

  const handleScenarioSelect = (scenario) => {
    setSelectedScenario(scenario);
  };

  const handleCustomScenarioSubmit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/save-scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customScenario),
      });
      
      if (response.ok) {
        const saved = await response.json(); // { success, scenario }
        setShowCustomDialog(false);
        setCustomScenario({ title: '', scenario: '', clientBackground: '' });
        // 옵티미스틱 업데이트: 새 시나리오를 목록에 추가하고 선택
        setScenarios(prev => [...prev, saved.scenario]);
        setSelectedScenario(saved.scenario); // 중요: 새 시나리오 자동 선택
        showSnackbar('New scenario has been saved.', 'success');
      }
    } catch (error) {
      console.error('Scenario save error:', error);
      showSnackbar('Failed to save scenario.', 'error');
    }
  };

  const startCounseling = async () => {
    if (!selectedScenario) {
      showSnackbar('Please select a scenario.', 'warning');
      return;
    }

    if (!userApiKey.trim()) {
      showSnackbar('Please enter your OpenAI API key.', 'warning');
      return;
    }

    try {
      showSnackbar('Connecting to AI client...', 'info');
      
      // 에피메랄 키 요청
      const response = await fetch(`${API_BASE_URL}/get-ephemeral-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: selectedScenario.scenario,
          clientBackground: selectedScenario.clientBackground,
          apiKey: userApiKey.trim()
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.ephemeral_key) {
        setEphemeralKey(data.ephemeral_key);
        
        // WebRTC 연결 초기화 (시나리오 정보 포함)
        await webrtcManager.initializeConnection(
          data.ephemeral_key,
          selectedScenario.scenario,
          selectedScenario.clientBackground
        );
        setIsRecording(true);
        showSnackbar('Counseling session started. Please speak through the microphone.', 'success');
      } else {
        const errorMessage = data.error || 'Connection failed.';
        showSnackbar(errorMessage, 'error');
        console.error('API Error:', data);
      }
    } catch (error) {
      console.error('Counseling start error:', error);
      showSnackbar('Cannot start counseling. Please check microphone permissions.', 'error');
    }
  };

  const stopCounseling = () => {
    webrtcManager.stopConnection();
    setIsRecording(false);
    setIsConnected(false);
    setEphemeralKey(null);
    showSnackbar('Counseling session ended.', 'info');
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'success.main';
      case 'connecting':
        return 'warning.main';
      case 'disconnected':
        return 'error.main';
      default:
        return 'grey.500';
    }
  };

  return (
    <div className="App">
      <AppBar position="static">
        <Toolbar>
          <Psychology sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AI Counseling Training App
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeUp sx={{ color: getConnectionStatusColor() }} />
            <Typography variant="body2" sx={{ color: getConnectionStatusColor() }}>
              {connectionState === 'connected' ? 'Connected' : 
               connectionState === 'connecting' ? 'Connecting' : 'Disconnected'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          {/* Scenario Selection Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h5" gutterBottom>
                Scenario Selection
              </Typography>
              
              <Button
                variant="contained"
                color="primary"
                onClick={() => setShowCustomDialog(true)}
                sx={{ mb: 2 }}
                fullWidth
              >
                Create New Scenario
              </Button>

              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {scenarios.map((scenario) => (
                  <Card
                    key={scenario.id}
                    sx={{
                      mb: 2,
                      cursor: 'pointer',
                      border: selectedScenario?.id === scenario.id ? 2 : 1,
                      borderColor: selectedScenario?.id === scenario.id ? 'primary.main' : 'grey.300',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                        transition: 'all 0.3s ease'
                      }
                    }}
                    onClick={() => handleScenarioSelect(scenario)}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {scenario.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {scenario.scenario}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Counseling Session Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h5" gutterBottom>
                Counseling Session
              </Typography>

              {selectedScenario && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Selected Scenario: {selectedScenario.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {selectedScenario.clientBackground}
                  </Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    In this scenario, the AI plays the client role and you are the counselor.
                  </Alert>
                </Box>
              )}

              {/* API Key Input */}
              <TextField
                type="password"
                label="OpenAI API Key *"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                placeholder="sk-..."
                fullWidth
                required
                autoComplete="off"
                sx={{ mb: 2 }}
                helperText="Your OpenAI API key is required to use this service"
                error={!userApiKey.trim()}
              />
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Required:</strong> You must provide your own OpenAI API key to use this service. 
                  Your key is only used to create temporary sessions and is not stored.
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={startCounseling}
                  disabled={!selectedScenario || isRecording || !userApiKey.trim()}
                  fullWidth
                >
                  Start Session
                </Button>

                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Stop />}
                  onClick={stopCounseling}
                  disabled={!isRecording}
                  fullWidth
                >
                  End Session
                </Button>
              </Box>

              {isRecording && (
                <Box sx={{ mt: 3, textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                  <Typography variant="h6" color="white" gutterBottom>
                    Session in Progress
                  </Typography>
                  <Typography variant="body2" color="white" sx={{ mb: 2 }}>
                    Please speak through the microphone. The AI will respond as the client.
                  </Typography>
                  <Mic sx={{ fontSize: 40, color: 'white', animation: 'pulse 1.5s infinite' }} />
                  
                  {/* Emotion Control Buttons */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Typography variant="body2" color="white" sx={{ width: '100%', mb: 1 }}>
                      Adjust Client's Emotional State:
                    </Typography>
                    {['sad', 'anxious', 'angry', 'relieved', 'hopeful', 'confused', 'neutral'].map((emotion) => (
                      <Button
                        key={emotion}
                        size="small"
                        variant="outlined"
                        onClick={() => webrtcManager.setEmotion(emotion)}
                        sx={{ 
                          color: 'white', 
                          borderColor: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1
                        }}
                      >
                        {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}

              {!selectedScenario && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Please select a scenario from the left to start counseling.
                </Alert>
              )}
              
              {!userApiKey.trim() && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Please enter your OpenAI API key to start a counseling session.
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Custom Scenario Dialog */}
      <Dialog open={showCustomDialog} onClose={() => setShowCustomDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Scenario</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Scenario Title"
            value={customScenario.title}
            onChange={(e) => setCustomScenario({...customScenario, title: e.target.value})}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Scenario Situation"
            multiline
            rows={3}
            value={customScenario.scenario}
            onChange={(e) => setCustomScenario({...customScenario, scenario: e.target.value})}
            sx={{ mb: 2 }}
            placeholder="e.g., Difficulties in daily life due to depression"
          />
          <TextField
            fullWidth
            label="Client Background Information"
            multiline
            rows={4}
            value={customScenario.clientBackground}
            onChange={(e) => setCustomScenario({...customScenario, clientBackground: e.target.value})}
            placeholder="e.g., 30-year-old woman, persistent depression for the past 6 months, sleep disorders, loss of appetite"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDialog(false)}>Cancel</Button>
          <Button onClick={handleCustomScenarioSubmit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default App;
