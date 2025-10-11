// No dotenv in scripts
const { WebUploader } = require('@irys/web-upload');
const { WebUploader: WebUploaderNode } = require('@irys/web-upload-node');
const { privateKeyToAccount } = require('viem/accounts');

const IRYS_TESTNET_URL = "https://turbo.ardrive.io";

async function uploadDeletionMarker(projectId, projectName, walletAddress) {
  try {
    // Get the private key from environment
    const privateKey = process.env.VITE_IRYS_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('VITE_IRYS_PRIVATE_KEY not found in environment variables');
    }

    const account = privateKeyToAccount(privateKey);
    console.log(`Using wallet address: ${account.address}`);

    // Create uploader instance
    const uploader = new WebUploaderNode({
      url: IRYS_TESTNET_URL,
      token: "ethereum",
      privateKey: privateKey,
    });

    // Create deletion marker
    const deletionMarker = {
      projectId,
      deletedAt: Date.now(),
      deletedBy: walletAddress,
      projectName
    };

    const data = Buffer.from(JSON.stringify(deletionMarker), 'utf-8');

    // Set up tags
    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'project-deletion' },
      { name: 'Project-ID', value: projectId },
      { name: 'Deleted-By', value: walletAddress },
      { name: 'Deleted-At', value: Date.now().toString() }
    ];

    console.log(`\nUploading deletion marker for project: ${projectName} (${projectId})`);
    console.log('Tags:', tags);

    // Upload to Irys
    const receipt = await uploader.upload(data, { tags });
    
    console.log(`Deletion marker uploaded successfully!`);
    console.log(`Transaction ID: ${receipt.id}`);
    console.log(`View at: https://uploader.irys.xyz/tx/${receipt.id}`);
    
    return receipt.id;
  } catch (error) {
    console.error('Error uploading deletion marker:', error);
    throw error;
  }
}

async function main() {
  const projectsToDelete = [
    {
      txId: '8sKesp87xzbAgPvBqxf8GENTcAGhkQYJhXVfLeKrKX7d',
      projectId: '8sKesp87xzbAgPvBqxf8GENTcAGhkQYJhXVfLeKrKX7d', // Using TX ID as project ID since Project-ID was undefined
      projectName: 'ooooo',
      author: '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738'
    },
    // Add the other two if we can identify them
    {
      txId: 'GY3KyueFUWho4EzjchEoEKtek9BoMTW2YkBAN6TgfYnj',
      projectId: 'GY3KyueFUWho4EzjchEoEKtek9BoMTW2YkBAN6TgfYnj',
      projectName: 'Unknown Project 1',
      author: '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738'
    },
    {
      txId: 'DK7vAixK12rCmcBvkHtz5PTyDwGr732qiczUqxaymHuq',
      projectId: 'DK7vAixK12rCmcBvkHtz5PTyDwGr732qiczUqxaymHuq',
      projectName: 'Unknown Project 2',
      author: '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738'
    }
  ];

  console.log('=== Manual Project Deletion ===\n');
  
  for (const project of projectsToDelete) {
    try {
      console.log(`\nProcessing: ${project.projectName}`);
      await uploadDeletionMarker(
        project.projectId,
        project.projectName,
        project.author
      );
      console.log('✓ Deletion marker uploaded successfully\n');
    } catch (error) {
      console.error(`✗ Failed to delete ${project.projectName}:`, error.message);
    }
  }
  
  console.log('\n=== Deletion process completed ===');
}

main().catch(console.error);
