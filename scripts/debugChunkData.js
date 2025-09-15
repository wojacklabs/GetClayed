const fetch = require('node-fetch');

async function debugChunkData() {
  // From error log
  const chunkSetId = '70abcbd6-adcd-434b-809a-1140c066e785';
  const firstChunkId = '2t57aUSUay2iwzMGbNn2wxHgPaWjBLDLbDQakTZQL9wM';
  
  console.log(`Checking chunk: ${firstChunkId}`);
  
  try {
    const response = await fetch(`https://uploader.irys.xyz/tx/${firstChunkId}/data`);
    const text = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('\nParsed as JSON:');
      console.log('Has chunk field:', !!data.chunk);
      if (data.chunk) {
        console.log('Chunk length:', data.chunk.length);
        console.log('First 100 chars of chunk:', data.chunk.substring(0, 100));
        
        // Check if it's base64 image data
        if (data.chunk.startsWith('iVBORw0KGgo')) {
          console.log('\nThis is PNG image data in base64!');
        }
      }
    } catch (e) {
      console.log('\nNot valid JSON:', e.message);
    }
  } catch (error) {
    console.error('Error fetching chunk:', error);
  }
}

debugChunkData();
