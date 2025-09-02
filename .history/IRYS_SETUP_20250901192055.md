# Irys Server-Side Upload Setup

This project now uses a server-side Irys upload approach where uploads are handled by a pre-configured wallet via Next.js API routes.

## Setup Instructions

1. Create or update `.env.local` file in the project root:
```
IRYS_PRIVATE_KEY=your_ethereum_private_key_here
```

Note: The private key is stored in server-side environment variables (not prefixed with NEXT_PUBLIC_)

2. Make sure the wallet has enough ETH on mainnet for Irys uploads
   - Small uploads (< 90KB) are free
   - Larger uploads require ETH balance

3. Build the Irys bundle:
```bash
npm run build:irys
```

4. Run the development server:
```bash
npm run dev
```

## How it works

1. **No wallet signatures needed for uploads** - The bundled client uses a pre-configured private key
2. **Smart contract payment** - Users still need to pay 0.1 IRYS service fee via smart contract
3. **Chunked uploads** - Large projects are automatically split into chunks under 90KB

## Benefits

- Simpler user experience (only one signature for payment)
- More reliable uploads
- No issues with wallet provider compatibility for uploads
- Uploads work even if user's wallet has no ETH balance

## Security Note

The private key in NEXT_PUBLIC_IRYS_PRIVATE_KEY should be for a dedicated upload wallet, not your main wallet. This wallet only needs enough ETH for Irys storage fees.
