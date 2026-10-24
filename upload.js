const fs = require('fs');
const path = require('path');
const REPO = 'colourfulkoaladevelopment/KoalaBTCmining';
const BRANCH = 'main';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) { console.error('�Y[�Y�Z[��X�]�H�ڙX��[\ˋ���N�ۜ��[\�H�]�[\�	ˉ�N�܈
�ۜ��[Hو�[\�H�]�Z]\�Y�[J�[JN�B��ۜ�[K���	ۢ��j��|� Project sync complete! Clearing temp files...');
  fs.unlinkSync('upload.js');
}
main();