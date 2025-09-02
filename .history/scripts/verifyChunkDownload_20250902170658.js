const axios = require('axios');

async function verifyChunkDownload() {
  // Manifest ID from the error log
  const manifestId = 'G9MDmHKpiKbZowae99EvV619SRrdY5mRCUorgDEMmj7r';
  
  console.log('=== Verifying Chunk Download ===\n');
  console.log(`Manifest ID: ${manifestId}\n`);
  
  try {
    // 1. Download manifest
    console.log('1. Downloading manifest...');
    const manifestResponse = await axios.get(`https://gateway.irys.xyz/${manifestId}`);
    const manifestData = manifestResponse.data;
    
    console.log('Manifest data:');
    console.log(`- Project ID: ${manifestData.projectId}`);
    console.log(`- Project Name: ${manifestData.projectName}`);
    console.log(`- Chunk Set ID: ${manifestData.chunkSetId}`);
    console.log(`- Total Chunks: ${manifestData.totalChunks}`);
    console.log(`- Created At: ${manifestData.createdAt}\n`);
    
    // 2. Download each chunk
    console.log('2. Downloading chunks...\n');
    const chunks = [];
    
    for (let i = 0; i < manifestData.chunks.length; i++) {
      const chunkId = manifestData.chunks[i];
      console.log(`Downloading chunk ${i + 1}/${manifestData.totalChunks}: ${chunkId}`);
      
      try {
        const chunkResponse = await axios.get(`https://gateway.irys.xyz/${chunkId}`);
        const chunkData = chunkResponse.data;
        
        // Verify chunk structure
        if (!chunkData.chunk) {
          console.error(`  ERROR: Chunk ${i} does not have 'chunk' property!`);
          console.log(`  Chunk data keys:`, Object.keys(chunkData));
        } else {
          chunks[i] = chunkData.chunk;
          console.log(`  ✓ Downloaded successfully, size: ${chunkData.chunk.length} characters`);
        }
      } catch (error) {
        console.error(`  ERROR downloading chunk ${i}:`, error.message);
      }
    }
    
    // 3. Reassemble data
    console.log('\n3. Reassembling data...');
    const reassembled = chunks.join('');
    console.log(`- Base64 data size: ${reassembled.length} characters`);
    
    // Decode from base64
    const decoded = Buffer.from(reassembled, 'base64').toString('utf-8');
    console.log(`- Decoded JSON size: ${decoded.length} characters`);
    
    // 4. Parse JSON
    console.log('\n4. Parsing JSON...');
    try {
      const project = JSON.parse(decoded);
      console.log('✓ JSON parsed successfully!');
      
      // Show project summary
      console.log('\nProject Summary:');
      console.log(`- Name: ${project.name}`);
      console.log(`- Author: ${project.author}`);
      console.log(`- Created: ${project.createdAt}`);
      console.log(`- Background Color: ${project.backgroundColor}`);
      console.log(`- Clay Objects: ${project.clayObjects.length}`);
      
      // Show first clay object
      if (project.clayObjects.length > 0) {
        const firstObject = project.clayObjects[0];
        console.log('\nFirst Clay Object:');
        console.log(`  - ID: ${firstObject.id}`);
        console.log(`  - Type: ${firstObject.type}`);
        console.log(`  - Color: ${firstObject.color}`);
        console.log(`  - Has deformed vertices: ${firstObject.deformedVertices ? 'Yes' : 'No'}`);
      }
      
    } catch (error) {
      console.error('ERROR parsing JSON:', error.message);
      console.log('\nFirst 500 characters of decoded data:');
      console.log(decoded.substring(0, 500));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyChunkDownload();
