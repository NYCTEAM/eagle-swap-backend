/**
 * 部署平台资金管理合约
 * 
 * 使用方法:
 * npx hardhat run scripts/deploy-treasury.js --network xlayer
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 开始部署 PlatformTreasury 合约...\n");

  // 获取部署者账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 部署者地址:", deployer.address);
  console.log("💰 部署者余额:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 部署合约
  console.log("⏳ 正在部署 PlatformTreasury...");
  const PlatformTreasury = await hre.ethers.getContractFactory("PlatformTreasury");
  const treasury = await PlatformTreasury.deploy();

  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();

  console.log("✅ PlatformTreasury 部署成功!");
  console.log("📍 合约地址:", treasuryAddress);
  console.log("👤 Owner:", await treasury.owner());
  console.log("💵 手续费率:", await treasury.platformFeeRate(), "basis points (0.1%)\n");

  // 保存部署信息
  const deployInfo = {
    network: hre.network.name,
    contractAddress: treasuryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    feeRate: "10", // 0.1%
    maxFeeRate: "100", // 1%
  };

  console.log("📄 部署信息:");
  console.log(JSON.stringify(deployInfo, null, 2));

  // 验证合约（如果在主网）
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ 等待区块确认...");
    await treasury.deploymentTransaction().wait(5);

    console.log("🔍 开始验证合约...");
    try {
      await hre.run("verify:verify", {
        address: treasuryAddress,
        constructorArguments: [],
      });
      console.log("✅ 合约验证成功!");
    } catch (error) {
      console.log("❌ 合约验证失败:", error.message);
    }
  }

  console.log("\n🎉 部署完成!");
  console.log("\n📝 下一步:");
  console.log("1. 将合约地址添加到前端配置");
  console.log("2. 设置操作员地址（可以收取手续费）");
  console.log("3. 设置提取者地址（可以提取资金）");
  console.log("4. 测试收取和提取功能");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
