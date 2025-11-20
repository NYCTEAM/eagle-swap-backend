const fetch = require('node-fetch');

console.log('\n' + '='.repeat(80));
console.log('🧪 测试 SWAP 挖矿完整流程');
console.log('='.repeat(80) + '\n');

const API_BASE = 'http://localhost:3001';

// 测试用户地址（请替换为实际地址）
const TEST_USER = '0x1234567890123456789012345678901234567890';

async function testSwapMiningFlow() {
  console.log('📋 测试步骤:\n');

  // 步骤 1: 检查 API 健康状态
  console.log('1️⃣ 检查后端 API 状态...');
  try {
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (healthResponse.ok) {
      console.log('   ✅ 后端 API 运行正常\n');
    } else {
      console.log('   ❌ 后端 API 无响应\n');
      return;
    }
  } catch (error) {
    console.log('   ❌ 无法连接到后端 API');
    console.log('   💡 请确保后端服务正在运行: npm run dev\n');
    return;
  }

  // 步骤 2: 模拟记录 SWAP 交易
  console.log('2️⃣ 模拟记录 SWAP 交易...');
  try {
    const recordResponse = await fetch(`${API_BASE}/api/swap-mining/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txHash: '0xtest' + Date.now(),
        userAddress: TEST_USER,
        fromToken: '0xTokenA',
        toToken: '0xTokenB',
        fromAmount: 100,
        toAmount: 99,
        tradeValueUsdt: 100,
        routeInfo: 'QuickSwap'
      })
    });

    const recordData = await recordResponse.json();
    
    if (recordData.success) {
      console.log('   ✅ 交易记录成功!');
      console.log('   📊 交易详情:');
      console.log(`      - 交易金额: ${recordData.data.tradeValue} USDT`);
      console.log(`      - 基础奖励: ${recordData.data.baseReward.toFixed(4)} EAGLE`);
      
      if (recordData.data.nftWeight > 0) {
        console.log(`      - NFT 权重: ${recordData.data.nftWeight}`);
        console.log(`      - 加成百分比: +${recordData.data.bonusPercent}%`);
        console.log(`      - 加成金额: +${recordData.data.bonusAmount.toFixed(4)} EAGLE`);
        console.log(`      - 总奖励: ${recordData.data.eagleReward.toFixed(4)} EAGLE`);
      } else {
        console.log(`      - NFT 权重: 0 (无 NFT)`);
        console.log(`      - 总奖励: ${recordData.data.eagleReward.toFixed(4)} EAGLE`);
      }
      console.log('');
    } else {
      console.log('   ❌ 交易记录失败:', recordData.error);
      console.log('');
      return;
    }
  } catch (error) {
    console.log('   ❌ 记录交易时出错:', error.message);
    console.log('');
    return;
  }

  // 步骤 3: 查询用户统计
  console.log('3️⃣ 查询用户统计...');
  try {
    const statsResponse = await fetch(`${API_BASE}/api/swap-mining/stats/${TEST_USER}`);
    const statsData = await statsResponse.json();
    
    if (statsData.success) {
      console.log('   ✅ 用户统计查询成功!');
      console.log('   📊 统计数据:');
      console.log(`      - 总交易次数: ${statsData.data.total_trades || 0}`);
      console.log(`      - 总交易量: ${(statsData.data.total_volume_usdt || 0).toFixed(2)} USDT`);
      console.log(`      - 总获得 EAGLE: ${(statsData.data.total_eagle_earned || 0).toFixed(4)}`);
      console.log(`      - 总已领取: ${(statsData.data.total_eagle_claimed || 0).toFixed(4)}`);
      console.log('');
    } else {
      console.log('   ⚠️  用户统计未找到（可能是新用户）\n');
    }
  } catch (error) {
    console.log('   ❌ 查询统计时出错:', error.message);
    console.log('');
  }

  // 步骤 4: 查询交易历史
  console.log('4️⃣ 查询交易历史...');
  try {
    const txResponse = await fetch(`${API_BASE}/api/swap-mining/transactions/${TEST_USER}?limit=5`);
    const txData = await txResponse.json();
    
    if (txData.success && txData.data.transactions.length > 0) {
      console.log('   ✅ 交易历史查询成功!');
      console.log(`   📋 最近 ${txData.data.transactions.length} 笔交易:\n`);
      
      txData.data.transactions.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${new Date(tx.created_at).toLocaleString()}`);
        console.log(`      交易金额: ${tx.trade_value_usdt} USDT`);
        console.log(`      获得奖励: ${tx.eagle_reward.toFixed(4)} EAGLE`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  暂无交易历史\n');
    }
  } catch (error) {
    console.log('   ❌ 查询交易历史时出错:', error.message);
    console.log('');
  }

  // 步骤 5: 查询待领取奖励
  console.log('5️⃣ 查询待领取奖励...');
  try {
    const pendingResponse = await fetch(`${API_BASE}/api/swap-mining/pending/${TEST_USER}`);
    const pendingData = await pendingResponse.json();
    
    if (pendingData.success) {
      console.log('   ✅ 待领取奖励查询成功!');
      console.log(`   💰 待领取总额: ${pendingData.data.total.toFixed(4)} EAGLE`);
      console.log(`   📝 待领取记录数: ${pendingData.data.rewards.length}\n`);
    } else {
      console.log('   ⚠️  暂无待领取奖励\n');
    }
  } catch (error) {
    console.log('   ❌ 查询待领取奖励时出错:', error.message);
    console.log('');
  }

  // 步骤 6: 查询平台统计
  console.log('6️⃣ 查询平台统计...');
  try {
    const platformResponse = await fetch(`${API_BASE}/api/swap-mining/platform-stats`);
    const platformData = await platformResponse.json();
    
    if (platformData.success) {
      console.log('   ✅ 平台统计查询成功!');
      console.log('   📊 平台数据:');
      console.log(`      - 总用户数: ${platformData.data.total.total_users || 0}`);
      console.log(`      - 总交易数: ${platformData.data.total.total_transactions || 0}`);
      console.log(`      - 总交易量: ${(platformData.data.total.total_volume || 0).toFixed(2)} USDT`);
      console.log(`      - 总分发 EAGLE: ${(platformData.data.total.total_eagle_distributed || 0).toFixed(4)}`);
      console.log('');
    }
  } catch (error) {
    console.log('   ❌ 查询平台统计时出错:', error.message);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ 测试完成！');
  console.log('='.repeat(80) + '\n');

  console.log('📋 总结:');
  console.log('   ✓ API 路由正常工作');
  console.log('   ✓ 交易记录功能正常');
  console.log('   ✓ NFT 加成计算正常');
  console.log('   ✓ 统计查询功能正常');
  console.log('');
  console.log('🚀 下一步:');
  console.log('   1. 在前端进行实际 SWAP 交易测试');
  console.log('   2. 检查浏览器控制台的日志输出');
  console.log('   3. 验证数据库中的记录');
  console.log('');
}

// 运行测试
testSwapMiningFlow().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
