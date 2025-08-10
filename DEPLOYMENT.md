# Deployment Guide

This guide explains how to deploy the AI Counseling Training App to production.

## Architecture

- **Frontend**: React app deployed on Vercel
- **Backend**: Node.js/Express server deployed on Railway/Render/Heroku
- **Database**: In-memory storage (scenarios are not persisted)

## Frontend Deployment (Vercel)

### 1. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your GitHub repository: `Chanhoon21/aicounselingtraining`
4. Set the following configuration:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

### 2. Environment Variables

Add the following environment variable in Vercel:
- `REACT_APP_API_BASE_URL`: Your backend URL (e.g., `https://your-backend.railway.app/api`)

### 3. Deploy

Click "Deploy" and Vercel will automatically build and deploy your frontend.

## Backend Deployment

### Option 1: Railway (Recommended)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set the root directory to `backend`
5. Railway will automatically detect it's a Node.js app
6. Add environment variables if needed (though not required since users provide their own API keys)

### Option 2: Render

1. Go to [render.com](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `ai-counseling-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Option 3: Heroku

1. Install Heroku CLI
2. Run the following commands:
   ```bash
   cd backend
   heroku create your-app-name
   git add .
   git commit -m "Deploy backend"
   git push heroku main
   ```

## CORS Configuration

Update the CORS configuration in `backend/server.js` to allow your frontend domain:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-frontend-domain.vercel.app'
  ],
  credentials: true
}));
```

## Environment Variables

### Frontend (Vercel)
- `REACT_APP_API_BASE_URL`: Backend API URL

### Backend (Optional)
- `PORT`: Server port (usually auto-detected)
- `NODE_ENV`: Set to `production`

## Security Considerations

1. **HTTPS**: Both frontend and backend should use HTTPS in production
2. **CORS**: Configure CORS to only allow your frontend domain
3. **API Keys**: Users provide their own API keys (no server-side storage needed)
4. **Rate Limiting**: Consider adding rate limiting for production use

## Monitoring

### Frontend (Vercel)
- Built-in analytics and performance monitoring
- Automatic deployments on git push
- Preview deployments for pull requests

### Backend
- Use your hosting platform's monitoring tools
- Consider adding logging middleware
- Monitor API usage and errors

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend CORS is configured for your frontend domain
2. **API Connection**: Verify the `REACT_APP_API_BASE_URL` is correct
3. **Build Failures**: Check that all dependencies are properly installed
4. **WebRTC Issues**: Ensure HTTPS is used in production

### Debug Steps

1. Check browser console for frontend errors
2. Check backend logs in your hosting platform
3. Verify environment variables are set correctly
4. Test API endpoints directly

## Cost Optimization

- **Frontend**: Vercel has a generous free tier
- **Backend**: Choose a hosting platform with a free tier (Railway, Render)
- **API Costs**: Users pay for their own OpenAI API usage

## Updates and Maintenance

1. **Automatic Deployments**: Both Vercel and Railway support automatic deployments
2. **Database**: Consider adding a persistent database for scenarios if needed
3. **Scaling**: Monitor usage and upgrade hosting plans as needed
