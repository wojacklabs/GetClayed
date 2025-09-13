# Vercel Deployment Guide

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/getclayed&env=NEXT_PUBLIC_PRIVY_APP_ID&envDescription=Privy%20App%20ID%20for%20authentication&project-name=getclayed&repository-name=getclayed)

## Manual Deployment Steps

### 1. Prerequisites

- Vercel account (https://vercel.com)
- Privy account and App ID (https://privy.io)
- Git repository with this code

### 2. Environment Setup

1. Get your Privy App ID:
   - Login to Privy Dashboard
   - Create a new app or use existing one
   - Copy the App ID (format: cmeweacxn014qlg0c61fthp1h)

### 3. Deploy to Vercel

#### Option A: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository
3. Configure project:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: .next
   - Install Command: `npm install`

4. Add Environment Variables:
   - Click "Environment Variables"
   - Add: `NEXT_PUBLIC_PRIVY_APP_ID` = `your_privy_app_id`

5. Click "Deploy"

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - Project name? getclayed (or your choice)
# - Directory? ./
# - Override settings? No

# Add environment variable
vercel env add NEXT_PUBLIC_PRIVY_APP_ID
```

### 4. Post-Deployment

1. Your app will be available at:
   - `https://your-project.vercel.app`
   - Custom domain can be added in Vercel dashboard

2. Test the deployment:
   - Visit your URL
   - Try creating clay objects
   - Test login functionality

### 5. Update Deployment

```bash
# For subsequent deployments
git push origin main
# Vercel will auto-deploy from GitHub

# Or manually:
vercel --prod
```

## Troubleshooting

### Build Errors

1. **Type errors**: Ensure TypeScript types are correct
2. **Missing dependencies**: Check package.json
3. **Environment variables**: Verify in Vercel dashboard

### Runtime Errors

1. **Privy not working**: Check NEXT_PUBLIC_PRIVY_APP_ID is set
2. **3D not rendering**: WebGL support required
3. **Storage issues**: Irys requires additional setup

## Production Considerations

1. **Performance**:
   - Consider CDN for assets
   - Optimize 3D models
   - Lazy load components

2. **Security**:
   - Keep Privy App ID secure
   - Use environment variables
   - Enable CORS if needed

3. **Monitoring**:
   - Enable Vercel Analytics
   - Set up error tracking
   - Monitor performance metrics
