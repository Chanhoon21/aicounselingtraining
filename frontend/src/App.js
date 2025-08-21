import React, { useState, useEffect, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Mic,
  PlayArrow,
  Stop,
  Psychology,
  VolumeUp,
  Delete
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
  const [userId, setUserId] = useState(''); // 사용자 ID

  // Conversation log (one list; we’ll label speaker)
  // roles used: 'client' | 'counselor' | 'session_transcript' (bulk)
  const [log, setLog] = useState([]);
  const aiBuffers = useRef({}); // assemble AI text per response

  // Recording/transcription
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcriptLanguage, setTranscriptLanguage] = useState('auto'); // 'auto' | 'en' | 'ko'

  // Client verbosity
  const [clientVerbosity, setClientVerbosity] = useState('terse'); // 'terse' | 'normal' | 'chatty'

  // Live counselor STT toggle/state
  const [liveUserSTT, setLiveUserSTT] = useState(true);
  const [sttAvailable, setSttAvailable] = useState(false);
  const sttRecRef = useRef(null);
  const sttActiveRef = useRef(false);

  // Load scenarios & initialize user
  useEffect(() => { initializeUser(); }, []);

  const initializeUser = async () => {
    try {
      let storedUserId = localStorage.getItem('userId');
      if (!storedUserId) {
        const response = await fetch(`${API_BASE_URL}/create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          storedUserId = data.userId;
          localStorage.setItem('userId', storedUserId);
        }
      }
      setUserId(storedUserId || '');
      fetchScenarios(storedUserId || '');
    } catch (error) {
      console.error('User initialization error:', error);
      showSnackbar('사용자 초기화에 실패했습니다.', 'error');
    }
  };

  // Check Web Speech API availability
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttAvailable(!!SR);
  }, []);

  // WebRTC callbacks
  useEffect(() => {
    webrtcManager.onConnectionStateChange = (state) => {
      setConnectionState(state);
      if (state === 'connected') {
        setIsConnected(true);
        showSnackbar('Connected to AI client.', 'success');
      } else if (state === 'disconnected') {
        setIsConnected(false);
        setIsRecording(false);
        stopUserSTT(); // ensure mic STT stops
      }
    };

    webrtcManager.onTrack = (event) => {
      // remote audio arrives here
    };

    // AI (client) text from Realtime events
    webrtcManager.onMessage = (data) => {
      if (!data?.type) return;
      if (data.type === 'response.output_text.delta') {
        const id = data.response_id || data.item_id || 'default';
        aiBuffers.current[id] = (aiBuffers.current[id] || '') + (data.delta || '');
      }
      if (data.type === 'response.completed') {
        const id = data.response_id || data.item_id || 'default';
        const text = (aiBuffers.current[id] || '').trim();
        if (text) setLog(prev => [...prev, { role: 'client', text, t: Date.now() }]);
        delete aiBuffers.current[id];
      }
    };

    return () => {
      webrtcManager.stopConnection();
      stopUserSTT();
    };
  }, []);

  const showSnackbar = (message, severity = 'info') => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  const fetchScenarios = async (uid) => {
    try {
      const response = await fetch(`${API_BASE_URL}/scenarios?userId=${uid}`);
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error('Scenario load error:', error);
      showSnackbar('Failed to load scenarios.', 'error');
    }
  };

  const handleScenarioSelect = (scenario) => setSelectedScenario(scenario);

  const handleScenarioDelete = async (scenarioId) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setScenarios(prev => prev.filter(s => s.id !== scenarioId));
        if (selectedScenario && selectedScenario.id === scenarioId) setSelectedScenario(null);
        showSnackbar('시나리오가 삭제되었습니다.', 'success');
      } else {
        const error = await response.json();
        showSnackbar(error.error || '시나리오 삭제에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Scenario delete error:', error);
      showSnackbar('시나리오 삭제에 실패했습니다.', 'error');
    }
  };

  const handleCustomScenarioSubmit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/save-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...customScenario, userId }),
      });
      if (response.ok) {
        const saved = await response.json();
        setShowCustomDialog(false);
        setCustomScenario({ title: '', scenario: '', clientBackground: '' });
        setScenarios(prev => [...prev, saved.scenario]);
        setSelectedScenario(saved.scenario);
        showSnackbar('New scenario has been saved.', 'success');
      }
    } catch (error) {
      console.error('Scenario save error:', error);
      showSnackbar('Failed to save scenario.', 'error');
    }
  };

  // ---- Live counselor STT (single mixed transcript with speaker labels) ----
  const startUserSTT = () => {
    if (!sttAvailable || sttActiveRef.current || !liveUserSTT) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = transcriptLanguage === 'en' ? 'en-US' : (transcriptLanguage === 'ko' ? 'ko-KR' : 'en-US'); // default to EN; change if you prefer
    r.interimResults = true;
    let finalText = '';

    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += text;
        else interim += text;
      }
      // (Optional) show interim in UI if you want
    };

    r.onerror = () => { /* ignore minor errors */ };
    r.onend = () => {
      sttActiveRef.current = false;
      if (finalText.trim()) {
        setLog(prev => [...prev, { role: 'counselor', text: finalText.trim(), t: Date.now() }]);
      }
      // Restart if still in session & toggle on (continuous effect)
      if (isRecording && liveUserSTT) {
        startUserSTT();
      }
    };

    r.start();
    sttRecRef.current = r;
    sttActiveRef.current = true;
  };

  const stopUserSTT = () => {
    try {
      sttRecRef.current?.stop();
    } catch {}
    sttActiveRef.current = false;
  };
  // -------------------------------------------------------------------------

  const startCounseling = async () => {
    if (!selectedScenario) return showSnackbar('Please select a scenario.', 'warning');
    if (!userApiKey.trim()) return showSnackbar('Please enter your OpenAI API key.', 'warning');

    try {
      // push verbosity into engine before connect
      webrtcManager.setVerbosity(clientVerbosity);

      showSnackbar('Connecting to AI client...', 'info');
      const response = await fetch(`${API_BASE_URL}/get-ephemeral-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: selectedScenario.scenario,
          clientBackground: selectedScenario.clientBackground,
          apiKey: userApiKey.trim()
        }),
      });
      const data = await response.json();
      if (response.ok && data.ephemeral_key) {
        setEphemeralKey(data.ephemeral_key);
        await webrtcManager.initializeConnection(
          data.ephemeral_key,
          selectedScenario.scenario,
          selectedScenario.clientBackground
        );
        setIsRecording(true);
        // kick off live counselor STT if enabled and available
        if (liveUserSTT && sttAvailable) startUserSTT();
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
    stopUserSTT();
    setIsSavingAudio(false);
    if (audioUrl) { try { URL.revokeObjectURL(audioUrl); } catch {} }
    setAudioUrl(null);
    setAudioBlob(null);
    setIsRecording(false);
    setIsConnected(false);
    setEphemeralKey(null);
    showSnackbar('Counseling session ended.', 'info');
  };

  // Mixed audio recording controls (mic + AI)
  const startSavingAudio = () => {
    try {
      webrtcManager.startMixedRecording();
      setIsSavingAudio(true);
      showSnackbar('Recording audio (mic + AI)...', 'info');
    } catch (e) {
      console.error(e);
      showSnackbar('Cannot start recording.', 'error');
    }
  };

  const stopSavingAudio = async () => {
    try {
      const res = await webrtcManager.stopMixedRecording();
      setIsSavingAudio(false);
      if (res?.url) {
        setAudioUrl(res.url);
        setAudioBlob(res.blob);
        showSnackbar('Recording ready to download.', 'success');
      }
    } catch (e) {
      console.error(e);
      showSnackbar('Failed to stop recording.', 'error');
    }
  };

  // Download transcript (.txt/.json)
  const downloadTranscript = (fmt = 'txt') => {
    if (!log.length) return showSnackbar('No transcript yet.', 'warning');
    if (fmt === 'json') {
      const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'transcript.json'; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const lines = log.map(x => `[${new Date(x.t).toLocaleString()}] ${x.role.toUpperCase()}: ${x.text}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transcript.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  // Transcribe the mixed recording (bulk, unlabeled) — we keep for convenience
  const transcribeRecording = async () => {
    if (!audioBlob) return showSnackbar('No recorded audio to transcribe.', 'warning');
    if (!userApiKey.trim()) return showSnackbar('Enter your OpenAI API key first.', 'warning');
    try {
      const form = new FormData();
      const filename = 'session.' + ((audioBlob.type || '').includes('mp4') ? 'm4a' : 'webm');
      form.append('audio', audioBlob, filename);
      form.append('apiKey', userApiKey.trim());
      if (transcriptLanguage && transcriptLanguage !== 'auto') {
        form.append('language', transcriptLanguage);
      }
      const r = await fetch(`${API_BASE_URL}/transcribe`, { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) {
        console.error('Transcription error:', data);
        return showSnackbar(data.error || 'Transcription failed.', 'error');
      }
      const text = (data.text || '').trim();
      if (text) {
        setLog(prev => [...prev, { role: 'session_transcript', text, t: Date.now() }]);
        showSnackbar('Transcription complete (added to log).', 'success');
      } else {
        showSnackbar('Empty transcript.', 'warning');
      }
    } catch (e) {
      console.error(e);
      showSnackbar('Transcription request failed.', 'error');
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'success.main';
      case 'connecting': return 'warning.main';
      case 'disconnected': return 'error.main';
      default: return 'grey.500';
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {userId && (
              <Typography variant="body2" sx={{ color: 'white' }}>
                사용자: {userId.substring(0, 8)}...
              </Typography>
            )}
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
          {/* Scenario Selection */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h5" gutterBottom>Scenario Selection</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                The default scenarios are available to all users, while newly created scenarios are visible only to you.
              </Alert>
              <Button variant="contained" color="primary" onClick={() => setShowCustomDialog(true)} sx={{ mb: 2 }} fullWidth>
                Create New Scenario
              </Button>
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {scenarios.map((scenario) => (
                  <Card
                    key={scenario.id}
                    sx={{
                      mb: 2, cursor: 'pointer',
                      border: selectedScenario?.id === scenario.id ? 2 : 1,
                      borderColor: selectedScenario?.id === scenario.id ? 'primary.main' : 'grey.300',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2, transition: 'all 0.3s ease' }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box 
                          sx={{ flex: 1, cursor: 'pointer' }}
                          onClick={() => setSelectedScenario(scenario)}
                        >
                          <Typography variant="h6" gutterBottom>{scenario.title}</Typography>
                          <Typography variant="body2" color="text.secondary">{scenario.scenario}</Typography>
                          {scenario.userId && scenario.userId !== 'default' && (
                            <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                              내가 만든 시나리오
                            </Typography>
                          )}
                        </Box>
                        {scenario.userId && scenario.userId !== 'default' && (
                          <Button
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('이 시나리오를 삭제하시겠습니까?')) {
                                handleScenarioDelete(scenario.id);
                              }
                            }}
                            sx={{ ml: 1 }}
                          >
                            <Delete fontSize="small" />
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Counseling Session */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h5" gutterBottom>Counseling Session</Typography>

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

              {/* Client Verbosity */}
              <TextField
                select
                label="Client verbosity"
                value={clientVerbosity}
                onChange={(e) => {
                  const v = e.target.value;
                  setClientVerbosity(v);
                  webrtcManager.setVerbosity(v);
                }}
                fullWidth
                sx={{ mb: 2 }}
                helperText="How long the client should typically speak"
              >
                <MenuItem value="terse">Terse (1 short sentence)</MenuItem>
                <MenuItem value="normal">Normal (1–2 short sentences)</MenuItem>
                <MenuItem value="chatty">Chatty (2–3 sentences)</MenuItem>
              </TextField>

              {/* Transcription Language (optional) */}
              <TextField
                select
                label="Transcription language"
                value={transcriptLanguage}
                onChange={(e) => setTranscriptLanguage(e.target.value)}
                fullWidth
                sx={{ mb: 1 }}
                helperText="Choose a language for transcription (auto by default)"
              >
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="en">English (en)</MenuItem>
                <MenuItem value="ko">Korean (ko)</MenuItem>
              </TextField>

              {/* Live counselor STT toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={liveUserSTT}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setLiveUserSTT(on);
                      if (on && isRecording && sttAvailable) startUserSTT();
                      if (!on) stopUserSTT();
                    }}
                    color="primary"
                  />
                }
                label={`Live counselor transcript ${sttAvailable ? '' : '(not supported in this browser)'}`}
                sx={{ mb: 2 }}
              />

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

                  {/* Emotion Controls */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Typography variant="body2" color="white" sx={{ width: '100%', mb: 1 }}>
                      Adjust Client's Emotional State:
                    </Typography>
                    {['sad','anxious','angry','relieved','hopeful','confused','neutral'].map((emotion) => (
                      <Button
                        key={emotion}
                        size="small"
                        variant="outlined"
                        onClick={() => webrtcManager.setEmotion(emotion)}
                        sx={{
                          color: 'white', borderColor: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                          fontSize: '0.7rem', minWidth: 'auto', px: 1
                        }}
                      >
                        {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                      </Button>
                    ))}
                  </Box>

                  {/* Recording & Downloads */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      onClick={isSavingAudio ? stopSavingAudio : startSavingAudio}
                      disabled={!isRecording}
                      fullWidth
                    >
                      {isSavingAudio ? 'Stop & Prepare Audio' : 'Start Recording Audio (mixed)'}
                    </Button>

                    <Button
                      variant="outlined"
                      disabled={!audioUrl}
                      fullWidth
                      onClick={() => {
                        const isMp4 = (audioBlob?.type || '').includes('mp4');
                        const a = document.createElement('a');
                        a.href = audioUrl;
                        a.download = `session.${isMp4 ? 'm4a' : 'webm'}`;
                        a.click();
                      }}
                    >
                      Download Mixed Audio
                    </Button>

                    <Button
                      variant="outlined"
                      disabled={!audioBlob}
                      fullWidth
                      onClick={transcribeRecording}
                    >
                      Transcribe Mixed (bulk)
                    </Button>

                    <Button variant="text" onClick={() => downloadTranscript('txt')} disabled={!log.length}>
                      Transcript (.txt)
                    </Button>
                    <Button variant="text" onClick={() => downloadTranscript('json')} disabled={!log.length}>
                      Transcript (.json)
                    </Button>
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
            onChange={(e) => setCustomScenario({ ...customScenario, title: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Scenario Situation"
            multiline rows={3}
            value={customScenario.scenario}
            onChange={(e) => setCustomScenario({ ...customScenario, scenario: e.target.value })}
            sx={{ mb: 2 }}
            placeholder="e.g., Difficulties in daily life due to depression"
          />
          <TextField
            fullWidth
            label="Client Background Information"
            multiline rows={4}
            value={customScenario.clientBackground}
            onChange={(e) => setCustomScenario({ ...customScenario, clientBackground: e.target.value })}
            placeholder="e.g., 30-year-old woman, persistent depression for the past 6 months, sleep disorders, loss of appetite"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDialog(false)}>Cancel</Button>
          <Button onClick={handleCustomScenarioSubmit} variant="contained">Save</Button>
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
