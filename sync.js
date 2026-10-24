const fs = require('fs');
const path = require('path');

const REPO = 'colourfulkoaladevelopment/KoalaBTCmining';
const BRANCH = 'main';

// Safely grabs the underlying classic token configuration
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || 'ghp_YOUR_ACTUAL_TOKEN_IF_ENV_IS_BLANK';

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (!name.includes('node_modules') && !name.includes('.git') && !name.includes('.expo') && !name.includes('.emergent')) {
        getFiles(name, filesList);
      }
    } else {
      filesList.push(name);
    }
  }
  return filesList;
}

async function uploadFile(filePath) {
  const relativePath = path.relative('.', filePath).replace(/\\/g, '/');
  if (relativePath === 'sync.js') return;
  const content = fs.readFileSync(filePath, 'base64');
  
  let sha;
  try {
    const res = await fetch(`https://github.com{REPO}/contents/${relativePath}?ref=${BRANCH}`, {
      headers: { 'Authorization': `token ${token}`, 'User-Agent': 'Bolt-Sync' }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch(e) {}

  const body = {
    message: `Deploy ${relativePath} Version 1.1.3`,
    content: content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://github.com{REPO}/contents/${relativePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Bolt-Sync'
    },
    body: JSON.stringify(body)
  });

  if (putRes.ok) {
    console.log(`✅ Synced: ${relativePath}`);
  } else {
    console.error(`❌ Failed: ${relativePath}`);
  }
}

async function main() {
  console.log('🚀 Executing direct cloud synchronization patch...');
  const files = getFiles('.');
  for (const file of files) {
    await uploadFile(file);
  }
  console.log('🎉 Project sync complete! Removing temp tracker.');
  try { fs.unlinkSync('sync.js'); } catch(e) {}
}

main();
