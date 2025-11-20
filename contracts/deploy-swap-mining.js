const hre = require("hardhat");

async function main() {
  console.log("🚀 部署 SwapMining 合约...\n");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", (await deployer.getBalance()).toString(), "\n");

  // EAGLE Token 地址（需要先部署 EAGLE Token）
  const EAGLE_TOKEN_ADDRESS = process.env.EAGLE_TOKEN_ADDRESS || "0x...";
  
  // 后端服务器地址
  const BACKEND_SERVER_ADDRESS = process.env.BACKEND_SERVER_ADDRESS || deployer.address;

  console.log("EAGLE Token 地址:", EAGLE_TOKEN_ADDRESS);
  console.log("后端服务器地址:", BACKEND_SERVER_ADDRESS, "\n");

  // 部署 SwapMining 合约
  const SwapMining = await hre.ethers.getContractFactory("SwapMining");
  const swapMining = await SwapMining.deploy(
    EAGLE_TOKEN_ADDRESS,
    BACKEND_SERVER_ADDRESS
  );

  await swapMining.deployed();

  console.log("✅ SwapMining 合约已部署!");
  console.log("合约地址:", swapMining.address);
  console.log("\n📋 合约信息:");
  console.log("  - EAGLE Token:", EAGLE_TOKEN_ADDRESS);
  console.log("  - Backend Server:", BACKEND_SERVER_ADDRESS);
  console.log("  - Reward Rate: 0.0003 EAGLE per USDT");
  console.log("  - Fee Rate: 0.1%");
  console.log("\n🏆 用户等级:");
  console.log("  - Bronze: 0+ USDT (1.0x)");
  console.log("  - Silver: 1,000+ USDT (1.2x)");
  console.log("  - Gold: 10,000+ USDT (1.5x)");
  console.log("  - Platinum: 100,000+ USDT (2.0x)");

  // 验证合约（可选）
  if (process.env.VERIFY_CONTRACT === "true") {
    console.log("\n⏳ 等待区块确认...");
    await swapMining.deployTransaction.wait(6);
    
    console.log("🔍 验证合约...");
    try {
      await hre.run("verify:verify", {
        address: swapMining.address,
        constructorArguments: [
          EAGLE_TOKEN_ADDRESS,
          BACKEND_SERVER_ADDRESS
        ],
      });
      console.log("✅ 合约验证成功!");
    } catch (error) {
      console.log("❌ 合约验证失败:", error.message);
    }
  }

  // 保存部署信息
  const fs = require('fs');
  const deployInfo = {
    network: hre.network.name,
    swapMiningAddress: swapMining.address,
    eagleTokenAddress: EAGLE_TOKEN_ADDRESS,
    backendServerAddress: BACKEND_SERVER_ADDRESS,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(
    'swap-mining-deployment.json',
    JSON.stringify(deployInfo, null, 2)
  );

  console.log("\n💾 部署信息已保存到 swap-mining-deployment.json");
  console.log("\n🎉 部署完成!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
