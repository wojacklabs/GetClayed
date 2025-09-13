# GetClayed - 3D Clay Sculpting Web Application

A web-based 3D sculpting application that allows users to create and manipulate clay-like objects in a browser.

## Features

- 3D sculpting with push/pull tools
- Multiple shape creation (sphere, cube, tetrahedron, lines, curves, 2D shapes)
- Real-time clay manipulation
- Color painting
- Object movement and rotation
- Undo/Redo functionality
- Save/Load projects (with Privy authentication)
- GLB export/import
- Folder organization system

## Tech Stack

- Next.js 15.5.2
- React Three Fiber
- Three.js
- Tailwind CSS
- Privy (Authentication)
- Irys (Decentralized Storage)

## Deployment to Vercel

### Prerequisites

1. A Vercel account
2. A Privy account and App ID

### Steps

1. **Fork/Clone this repository**

2. **Set up environment variables**
   - Copy `env.example` to `.env.local`
   - Add your Privy App ID

3. **Deploy to Vercel**
   
   Option A: Using Vercel CLI
   ```bash
   npm i -g vercel
   vercel
   ```

   Option B: Using GitHub integration
   - Connect your GitHub repository to Vercel
   - Vercel will automatically detect Next.js

4. **Configure Environment Variables in Vercel**
   - Go to your project settings in Vercel
   - Navigate to "Environment Variables"
   - Add: `NEXT_PUBLIC_PRIVY_APP_ID` with your Privy App ID

5. **Deploy**
   - Push to your main branch
   - Vercel will automatically build and deploy

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `NEXT_PUBLIC_PRIVY_APP_ID`: Your Privy application ID (required)

## Notes

- The application requires WebGL support in the browser
- For best performance, use a modern browser (Chrome, Firefox, Edge)
- Mobile support is limited due to 3D manipulation requirements