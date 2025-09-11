const fetch = require('node-fetch');

async function checkAvatarManifest(manifestId) {
  console.log(`\nChecking avatar manifest: ${manifestId}\n`);
  
  const urls = [
    `https://gateway.irys.xyz/${manifestId}`,
    `https://uploader.irys.xyz/tx/${manifestId}/data`,
    `https://arweave.net/${manifestId}`
  ];
  
  for (const url of urls) {
    console.log(`Trying ${url}...`);
    try {
      const response = await fetch(url);
      console.log(`Status: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`Response length: ${text.length} bytes`);
        
        try {
          const data = JSON.parse(text);
          console.log('\nParsed data:');
          console.log(JSON.stringify(data, null, 2));
          
          if (data.chunks && data.chunks.length > 0) {
            console.log(`\nFound ${data.chunks.length} chunks`);
            console.log('First chunk ID:', data.chunks[0]);
            console.log('Last chunk ID:', data.chunks[data.chunks.length - 1]);
          }
          
          return;
        } catch (e) {
          console.log('Not JSON, showing first 200 chars:');
          console.log(text.substring(0, 200));
        }
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    console.log('---');
  }
}

// Get manifest ID from command line
const manifestId = process.argv[2];
if (!manifestId) {
  console.log('Usage: node checkAvatarManifest.js <manifest-id>');
  process.exit(1);
}

checkAvatarManifest(manifestId);
