const axios = require('axios');

async function debugChunkIssue() {
  const lastChunkId = 'AvxaqdJRTi8NeUsGXBDzDX1HR9SXAG16fkwQYakQcEk';
  
  console.log('=== Debugging Last Chunk ===\n');
  console.log(`Chunk ID: ${lastChunkId}\n`);
  
  try {
    // Download the last chunk
    console.log('1. Downloading last chunk...');
    const response = await axios.get(`https://gateway.irys.xyz/${lastChunkId}`);
    
    console.log('\nResponse type:', typeof response.data);
    console.log('Response keys:', Object.keys(response.data));
    
    if (response.data.chunk) {
      console.log('\nChunk property found:');
      console.log('- Chunk length:', response.data.chunk.length);
      console.log('- First 100 chars:', response.data.chunk.substring(0, 100));
      console.log('- Last 100 chars:', response.data.chunk.substring(response.data.chunk.length - 100));
      
      // Check if it's valid base64
      try {
        const decoded = Buffer.from(response.data.chunk, 'base64').toString('utf-8');
        console.log('\n✓ Valid base64');
        console.log('- Decoded length:', decoded.length);
        console.log('- Last 200 chars of decoded:', decoded.substring(decoded.length - 200));
      } catch (e) {
        console.log('\n✗ Invalid base64:', e.message);
      }
    } else {
      console.log('\nNo chunk property! Full response:');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 1000));
    }
    
    // Also check transaction metadata
    console.log('\n2. Checking transaction metadata...');
    const txResponse = await axios.get(`https://uploader.irys.xyz/tx/${lastChunkId}`);
    
    console.log('\nTransaction info:');
    console.log('- ID:', txResponse.data.id);
    console.log('- Size:', txResponse.data.data_size, 'bytes');
    console.log('- Tags:');
    txResponse.data.tags.forEach(tag => {
      console.log(`  - ${tag.name}: ${tag.value}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugChunkIssue();
