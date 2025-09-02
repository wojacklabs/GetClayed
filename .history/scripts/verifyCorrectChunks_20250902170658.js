const axios = require('axios');

async function verifyCorrectChunks() {
  const manifestId = 'G9MDmHKpiKbZowae99EvV619SRrdY5mRCUorgDEMmj7r';
  const correctChunkSetId = '87491d99-42c2-423c-a9cc-2d9ee5dbf9c1'; // The actual chunk set ID
  
  console.log('=== Verifying with Correct Chunk Set ID ===\n');
  console.log(`Manifest ID: ${manifestId}`);
  console.log(`Correct Chunk Set ID: ${correctChunkSetId}\n`);
  
  try {
    // Download manifest
    const manifestResponse = await axios.get(`https://gateway.irys.xyz/${manifestId}`);
    const manifestData = manifestResponse.data;
    
    console.log(`Manifest claims Chunk Set ID: ${manifestData.chunkSetId}`);
    console.log(`But actual Chunk Set ID is: ${correctChunkSetId}\n`);
    
    // Download and reassemble chunks
    console.log('Downloading and reassembling chunks...\n');
    const chunks = [];
    
    for (let i = 0; i < manifestData.chunks.length; i++) {
      const chunkId = manifestData.chunks[i];
      console.log(`Chunk ${i + 1}/${manifestData.totalChunks}: ${chunkId}`);
      
      const chunkResponse = await axios.get(`https://gateway.irys.xyz/${chunkId}`);
      chunks[i] = chunkResponse.data.chunk;
      console.log(`  ✓ Size: ${chunkResponse.data.chunk.length}`);
    }
    
    // Reassemble
    console.log('\nReassembling data...');
    const reassembled = chunks.join('');
    console.log(`- Base64 size: ${reassembled.length}`);
    
    // Decode
    const decoded = Buffer.from(reassembled, 'base64').toString('utf-8');
    console.log(`- Decoded size: ${decoded.length}`);
    
    // Parse JSON
    console.log('\nParsing JSON...');
    try {
      const project = JSON.parse(decoded);
      console.log('✓ Successfully parsed!');
      
      console.log('\nProject info:');
      console.log(`- Name: ${project.name}`);
      console.log(`- Clay objects: ${project.clays.length}`);
      console.log(`- Background color: ${project.backgroundColor}`);
      
      console.log('\n✅ Data is complete and valid!');
      
    } catch (error) {
      console.error('❌ JSON parse error:', error.message);
      
      // Try to find where the data was cut off
      console.log('\nAnalyzing data cutoff...');
      console.log('Last 500 characters:', decoded.substring(decoded.length - 500));
      
      // Check if JSON is incomplete
      const openBraces = (decoded.match(/{/g) || []).length;
      const closeBraces = (decoded.match(/}/g) || []).length;
      const openBrackets = (decoded.match(/\[/g) || []).length;
      const closeBrackets = (decoded.match(/\]/g) || []).length;
      
      console.log(`\nBrace balance: { ${openBraces} vs } ${closeBraces}`);
      console.log(`Bracket balance: [ ${openBrackets} vs ] ${closeBrackets}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyCorrectChunks();
