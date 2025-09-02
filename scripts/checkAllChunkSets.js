const axios = require('axios');

async function checkAllChunkSets() {
  const manifestId = 'G9MDmHKpiKbZowae99EvV619SRrdY5mRCUorgDEMmj7r';
  
  console.log('=== Checking All Chunk Set IDs ===\n');
  
  try {
    // Download manifest
    const manifestResponse = await axios.get(`https://gateway.irys.xyz/${manifestId}`);
    const manifestData = manifestResponse.data;
    
    console.log('Manifest Chunk Set ID:', manifestData.chunkSetId);
    console.log('Total chunks:', manifestData.totalChunks);
    console.log('\nChecking each chunk:\n');
    
    for (let i = 0; i < manifestData.chunks.length; i++) {
      const chunkId = manifestData.chunks[i];
      console.log(`Chunk ${i + 1}: ${chunkId}`);
      
      try {
        // Get transaction metadata
        const txResponse = await axios.get(`https://uploader.irys.xyz/tx/${chunkId}`);
        const tags = {};
        txResponse.data.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });
        
        console.log(`  - Chunk Set ID: ${tags['Chunk-Set-ID']}`);
        console.log(`  - Chunk Index: ${tags['Chunk-Index']}`);
        console.log(`  - Created At: ${tags['Created-At']}`);
        
        if (tags['Chunk-Set-ID'] !== manifestData.chunkSetId) {
          console.log(`  ⚠️  MISMATCH! Expected: ${manifestData.chunkSetId}`);
        }
        
      } catch (error) {
        console.log(`  - Error: ${error.message}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllChunkSets();
