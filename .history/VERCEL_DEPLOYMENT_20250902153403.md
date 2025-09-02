# Vercel Deployment Guide

## Environment Variables Setup

To deploy this project on Vercel, you need to set up the following environment variables:

### 1. In Vercel Dashboard

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables" section
3. Add the following variable:

```
Name: NEXT_PUBLIC_IRYS_PRIVATE_KEY
Value: 149,233,126,150,63,34,9,190,26,8,139,132,33,159,98,33,216,142,0,75,65,63,221,245,93,116,85,39,224,24,148,101,143,157,102,51,113,61,71,125,32,20,244,10,28,79,181,219,26,157,220,41,23,26,243,14,56,210,178,81,222,55,49,122
```

**Important**: Make sure to:
- Set this for all environments (Production, Preview, Development)
- Don't add quotes around the value
- Copy the exact comma-separated numbers

### 2. Redeploy

After adding the environment variable:
1. Trigger a new deployment
2. The environment variable will be available in the build

## Troubleshooting

### "Private key not initialized" Error

If you see this error:
1. Check that `NEXT_PUBLIC_IRYS_PRIVATE_KEY` is set in Vercel
2. Verify the format is correct (comma-separated numbers)
3. Make sure there are exactly 64 numbers
4. Redeploy after adding/updating the environment variable

### Public Key Address

The Solana address for this private key is:
```
AfcWKLP89g1DxMvuKzPizt8yFP61JJCNsLyLYqFFRKqs
```

For files larger than 90KB, you'll need to fund this address with SOL.

## Security Note

While this private key is exposed to the client (`NEXT_PUBLIC_`), it's only used for data storage, not for holding funds. The actual payment for the service fee is done through the user's connected wallet.
