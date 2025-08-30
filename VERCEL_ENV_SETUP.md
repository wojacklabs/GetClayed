# Vercel Environment Variables Setup

## Error Fix

The error "Environment Variable references Secret which does not exist" occurs when trying to reference a secret that hasn't been created. 

## Solution

### Option 1: Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Click on "Settings" tab
3. Navigate to "Environment Variables" in the left sidebar
4. Add new variable:
   - **Name**: `NEXT_PUBLIC_PRIVY_APP_ID`
   - **Value**: `cmeweacxn014qlg0c61fthp1h` (your Privy App ID)
   - **Environment**: Select all (Production, Preview, Development)
5. Click "Save"

### Option 2: Vercel CLI

```bash
# Add environment variable
vercel env add NEXT_PUBLIC_PRIVY_APP_ID production

# When prompted, enter:
# Value: cmeweacxn014qlg0c61fthp1h

# Also add for preview and development
vercel env add NEXT_PUBLIC_PRIVY_APP_ID preview
vercel env add NEXT_PUBLIC_PRIVY_APP_ID development
```

### Option 3: Using Vercel CLI with direct value

```bash
# Set for all environments at once
echo "cmeweacxn014qlg0c61fthp1h" | vercel env add NEXT_PUBLIC_PRIVY_APP_ID production
echo "cmeweacxn014qlg0c61fthp1h" | vercel env add NEXT_PUBLIC_PRIVY_APP_ID preview
echo "cmeweacxn014qlg0c61fthp1h" | vercel env add NEXT_PUBLIC_PRIVY_APP_ID development
```

## After Setting Environment Variables

1. Redeploy your project:
   ```bash
   vercel --prod
   ```
   
   Or push a commit to trigger automatic deployment.

2. Verify the deployment:
   - Check build logs for any errors
   - Visit your deployed URL
   - Test the login functionality

## Notes

- Environment variables starting with `NEXT_PUBLIC_` are exposed to the browser
- The Privy App ID is safe to expose as it's meant for client-side use
- Make sure to use the exact same variable name in your code and Vercel settings
