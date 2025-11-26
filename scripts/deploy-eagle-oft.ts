import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // LayerZero Endpoint Addresses (V2)
  // 请务必核实 X Layer 的 Endpoint 地址，通常 EVM 链通用地址是 0x1a44076050125825900e736c501f859c50fE728c
  // 但新链可能不同，建议查阅 LayerZero 文档
  const LZ_ENDPOINTS: { [key: string]: string } = {
    "xlayer": "0x1a44076050125825900e736c501f859c50fE728c", // 需确认
    "bsc": "0x1a44076050125825900e736c501f859c50fE728c",    // 需确认
    "ethereum": "0x1a44076050125825900e736c501f859c50fE728c",
    // ... other chains
  };

  const networkName = network.name;
  console.log(`Deploying to network: ${networkName}`);

  // 1. Determine LayerZero Endpoint
  const lzEndpoint = LZ_ENDPOINTS[networkName];
  if (!lzEndpoint) {
    throw new Error(`No LayerZero Endpoint configured for ${networkName}`);
  }

  // 2. Determine isHomeChain
  // 只有 X Layer 是 Home Chain (初始铸造代币)
  const isHomeChain = networkName === "xlayer";

  console.log(`Configuration:`);
  console.log(`- LZ Endpoint: ${lzEndpoint}`);
  console.log(`- Is Home Chain: ${isHomeChain}`);
  console.log(`- Initial Supply: ${isHomeChain ? "1,000,000,000 EAGLE" : "0"}`);

  // 3. Deploy Contract
  const EagleTokenOFT = await ethers.getContractFactory("EagleTokenOFT");
  const eagle = await EagleTokenOFT.deploy(
    lzEndpoint,
    deployer.address, // Delegate / Owner
    isHomeChain
  );

  await eagle.waitForDeployment();

  const address = await eagle.getAddress();
  console.log(`\n✅ EagleTokenOFT Deployed to ${networkName}: ${address}`);
  
  if (isHomeChain) {
    const balance = await eagle.balanceOf(deployer.address);
    console.log(`💰 Owner Balance: ${ethers.formatEther(balance)} EAGLE`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
