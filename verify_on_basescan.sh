#!/bin/bash

echo "🔍 Verifying contracts on Basescan..."

cd contracts

echo "1. Verifying ClayLibrary..."
npx hardhat verify --network base 0xe90BB6281B7Af6211519e5721A5b4985Ea693a49 0x0000000000000000000000000000000000000000

echo "2. Verifying ClayRoyalty..."
npx hardhat verify --network base 0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a 0xe90BB6281B7Af6211519e5721A5b4985Ea693a49

echo "3. Verifying ClayMarketplace..."
npx hardhat verify --network base 0x7f993C490aA7934A537950dB8b5f22F8B5843884 0xe90BB6281B7Af6211519e5721A5b4985Ea693a49 0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a

echo "✅ Verification commands executed!"
