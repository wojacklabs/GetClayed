# Irys Fixed Key Setup

This project uses a fixed Solana private key for Irys uploads (like CM's Note).

## Setup Instructions

1. **Generate or Get a Solana Private Key**
   - You can use a Solana wallet to generate a new keypair
   - Export the private key as an array of numbers (Uint8Array format)

2. **Set Environment Variable**
   Create a `.env.local` file in the project root and add:
   ```
   NEXT_PUBLIC_IRYS_PRIVATE_KEY=123,456,789,... (comma-separated numbers)
   ```
   
   Example format:
   ```
   NEXT_PUBLIC_IRYS_PRIVATE_KEY=123,45,67,89,12,34,56,78,90,123,45,67,89,12,34,56,78,90,123,45,67,89,12,34,56,78,90,123,45,67,89,12
   ```

3. **Fund the Wallet**
   - The public key for this wallet will be displayed in the console when the app starts
   - Fund this Solana wallet with some SOL for Irys uploads
   - For free uploads (under 90KB), no funding is needed

## Important Notes

- The private key is exposed to the client (NEXT_PUBLIC_)
- This is suitable for demo/development, but for production consider using a server-side API
- All uploads use this fixed key regardless of which wallet the user connects
- Payment for the 0.1 IRYS service fee still uses the user's connected wallet

## How It Works

1. User connects their Ethereum wallet and pays the 0.1 IRYS service fee via smart contract
2. Upload to Irys storage uses the fixed Solana private key
3. This separates payment (user wallet) from storage (fixed key)