# AI Counseling Training App

An interactive AI-powered counseling training application that allows users to practice counseling skills with an AI client that responds with natural, emotionally-aware voice communication.

## Features

- **Real-time Voice Communication**: WebRTC-based voice interaction with AI
- **Scenario Management**: Pre-built and custom counseling scenarios
- **User-specific Scenarios**: Each user can create and manage their own scenarios privately
- **Emotion-Aware AI**: AI responds with appropriate emotional tones based on scenarios
- **Dynamic Voice Modulation**: Real-time adjustment of AI's emotional state
- **English Interface**: Full English UI and voice responses
- **OpenAI Realtime API**: Powered by GPT-4o Realtime with expressive voice synthesis
- **User API Key Support**: Each user provides their own OpenAI API key for privacy and cost control

## User Management

### Scenario Privacy
- **Default Scenarios**: Pre-built scenarios available to all users
- **Personal Scenarios**: Custom scenarios created by users are private and only visible to the creator
- **User Identification**: Each user gets a unique ID stored locally for session persistence
- **Scenario Management**: Users can create, view, and delete their own scenarios

### How It Works
1. **First Visit**: A unique user ID is automatically generated and stored in your browser
2. **Scenario Creation**: When you create a new scenario, it's associated with your user ID
3. **Private Access**: Only you can see and manage scenarios you've created
4. **Session Persistence**: Your user ID persists across browser sessions using local storage

## Tech Stack

### Frontend
- React 19
- Material-UI (MUI)
- WebRTC for real-time communication

### Backend
- Node.js
- Express.js
- OpenAI Realtime API

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- OpenAI API key (required)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Chanhoon21/aicounselingtraining.git
   cd aicounselingtraining
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Start backend server
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   
   # Start frontend app
   npm start
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Usage

1. **User Initialization**: Your unique user ID is automatically created on first visit
2. **Enter API Key**: Provide your OpenAI API key in the designated field
3. **Select a Scenario**: Choose from default scenarios or create a custom one
4. **Create Custom Scenarios**: Add your own counseling scenarios (private to you)
5. **Manage Scenarios**: Delete your custom scenarios as needed
6. **Start Session**: Click "Start Session" to begin counseling
7. **Practice Counseling**: Speak through your microphone to interact with the AI client
8. **Adjust Emotions**: Use emotion buttons to modify the AI's emotional state during the session
9. **End Session**: Click "End Session" when finished

## API Endpoints

- `POST /api/create-user`: Generate a new user ID
- `POST /api/get-ephemeral-key`: Generate OpenAI Realtime session (requires user API key)
- `POST /api/save-scenario`: Save custom counseling scenario (requires user ID)
- `GET /api/scenarios`: Retrieve available scenarios (filtered by user ID)
- `DELETE /api/scenarios/:id`: Delete a custom scenario (requires user ID)
- `GET /api/health`: Server health check

## Security & Privacy

- **API Key Privacy**: Your OpenAI API key is only used to create temporary sessions and is never stored
- **User Isolation**: Each user's custom scenarios are completely isolated from other users
- **Local Storage**: User IDs are stored locally in your browser for session persistence
- **No Server Storage**: The server does not store any personal data or API keys
- **HTTPS Recommended**: For production use, ensure you're using HTTPS

## Voice Features

### Available Voices
- **Ballad**: Expressive voice with greater emotional range
- **Emotion Control**: Real-time adjustment of AI's emotional state
- **Natural Prosody**: Human-like pacing, pauses, and pitch variation

### Emotional States
- **Sad/Depressed**: Slower pace, softer volume, slight shakiness
- **Anxious**: Quicker pace, clipped sentences, shallow breaths
- **Angry**: Tense, firmer volume, measured tone
- **Relieved**: Warmer tone, lighter pace, small exhale sounds
- **Hopeful**: Brighter tone, more animated energy
- **Confused**: Slower, hesitant, questioning tone
- **Neutral**: Even pace, clear and calm

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the Realtime API
- Material-UI for the beautiful React components
- WebRTC community for real-time communication technology

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
