const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 初始化所有数据库...\n');

const scripts = [
  'init-swap-mining.js',
  'init-node-levels.js',
  'init-referrer-level.js',
  'init-community-system.js'
];

for (const script of scripts) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 运行: ${script}`);
  console.log('='.repeat(60));
  
  try {
    execSync(`node ${path.join(__dirname, script)}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  } catch (error) {
    console.error(`❌ ${script} 执行失败:`, error.message);
  }
}

console.log('\n' + '='.repeat(60));
console.log('🎉 所有数据库初始化完成！');
console.log('='.repeat(60));
console.log('\n请重启后端服务以加载新的数据库结构。');
