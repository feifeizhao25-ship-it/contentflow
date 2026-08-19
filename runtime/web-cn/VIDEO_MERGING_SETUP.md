# Video Merging Service Configuration

This document explains how to configure the video merging service for multi-segment video generation.

## Shotstack API Setup (Recommended)

Shotstack is a professional cloud-based video editing API that provides reliable video concatenation.

### 1. Get API Key

1. Sign up at https://shotstack.io/
2. Navigate to your dashboard
3. Copy your API key from the "API Keys" section

### 2. Configure Environment Variable

Add to your `.env.local` file:

```bash
SHOTSTACK_API_KEY=your_shotstack_api_key_here
```

### 3. Pricing

Shotstack offers:
- **Free tier**: 20 renders/month
- **Developer**: $49/month for 500 renders
- **Production**: Custom pricing

For testing, the free tier is sufficient.

## Alternative Options

If you don't want to use Shotstack, you can:

### Option 1: Cloudinary (Recommended Alternative)

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Cloudinary supports video transformations and concatenation.

### Option 2: Self-Hosted FFmpeg

Run your own FFmpeg service:
- Deploy a simple Node.js service with fluent-ffmpeg
- Host on Railway, Render, or your own server
- No API key needed, but requires server management

### Option 3: Fallback Mode (Current Default)

Without any API key configured, the system will:
- Generate all video segments successfully
- Return only the first segment as the "merged" video
- User can manually download and merge segments if needed

## How It Works

1. **User selects video duration** (e.g., 30 seconds)
2. **System generates segments**:
   - 30s ÷ 5s = 6 segments
   - Each segment uses consistent prompts for continuity
3. **Shotstack merges segments**:
   - Creates a timeline with all clips
   - Renders final video
   - Returns merged video URL
4. **User receives complete video**

## Testing

To test the video merging:

1. Enable video generation in the UI
2. Select a duration > 10 seconds (e.g., 15s or 20s)
3. Generate content
4. Check console logs for merge status

## Troubleshooting

### "SHOTSTACK_API_KEY not configured"
- Add the API key to `.env.local`
- Restart the dev server

### "Video merge failed"
- Check Shotstack dashboard for render status
- Verify API key is valid
- Check video URLs are accessible

### Merge takes too long
- Shotstack typically takes 30-60 seconds per minute of video
- For 30s video (6 segments), expect ~2-3 minutes total

## Cost Optimization

To minimize costs:
1. Use shorter durations (10s or less) for single-segment videos
2. Only use multi-segment for important content
3. Monitor your Shotstack usage in their dashboard
4. Consider caching merged videos to avoid re-rendering
