/**
 * NFT 签名生成服务
 * 用于生成 mintWithSignature 所需的后端签名
 */

import { ethers } from 'ethers';

export class NFTSignatureService {
  private static signerWallet: ethers.Wallet;

  /**
   * 初始化签名者钱包
   */
  static initialize() {
    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('SIGNER_PRIVATE_KEY not found in environment variables');
    }

    this.signerWallet = new ethers.Wallet(privateKey);
    console.log('✅ NFT Signature Service initialized');
    console.log('   Signer Address:', this.signerWallet.address);
  }

  /**
   * 生成铸造签名
   * 
   * 签名消息格式（与合约一致）:
   * keccak256(abi.encodePacked(
   *   userAddress,
   *   globalTokenId,
   *   level,
   *   totalMinted,
   *   deadline,
   *   contractAddress,
   *   chainId
   * ))
   */
  static async generateMintSignature(params: {
    userAddress: string;
    globalTokenId: number;
    level: number;
    totalMinted: number;
    deadline: number;
    contractAddress: string;
    chainId: number;
  }): Promise<string> {
    const {
      userAddress,
      globalTokenId,
      level,
      totalMinted,
      deadline,
      contractAddress,
      chainId
    } = params;

    // 确保钱包已初始化
    if (!this.signerWallet) {
      this.initialize();
    }

    // 构造消息哈希（与合约中的一致）
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint8', 'uint256', 'uint256', 'address', 'uint256'],
      [
        userAddress,
        globalTokenId,
        level,
        totalMinted,
        deadline,
        contractAddress,
        chainId
      ]
    );

    // 签名（使用 EIP-191 格式）
    const signature = await this.signerWallet.signMessage(ethers.getBytes(messageHash));

    console.log('🔐 Generated signature for:');
    console.log('   User:', userAddress);
    console.log('   Global Token ID:', globalTokenId);
    console.log('   Level:', level);
    console.log('   Total Minted:', totalMinted);
    console.log('   Deadline:', new Date(deadline * 1000).toISOString());
    console.log('   Contract:', contractAddress);
    console.log('   Chain ID:', chainId);

    return signature;
  }

  /**
   * 验证签名（用于测试）
   */
  static async verifySignature(params: {
    userAddress: string;
    globalTokenId: number;
    level: number;
    totalMinted: number;
    deadline: number;
    contractAddress: string;
    chainId: number;
    signature: string;
  }): Promise<boolean> {
    const {
      userAddress,
      globalTokenId,
      level,
      totalMinted,
      deadline,
      contractAddress,
      chainId,
      signature
    } = params;

    // 重新构造消息哈希
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint8', 'uint256', 'uint256', 'address', 'uint256'],
      [
        userAddress,
        globalTokenId,
        level,
        totalMinted,
        deadline,
        contractAddress,
        chainId
      ]
    );

    // 恢复签名者地址
    const recoveredAddress = ethers.verifyMessage(
      ethers.getBytes(messageHash),
      signature
    );

    const isValid = recoveredAddress.toLowerCase() === this.signerWallet.address.toLowerCase();

    console.log('🔍 Signature verification:');
    console.log('   Expected signer:', this.signerWallet.address);
    console.log('   Recovered signer:', recoveredAddress);
    console.log('   Valid:', isValid);

    return isValid;
  }

  /**
   * 获取签名者地址
   */
  static getSignerAddress(): string {
    if (!this.signerWallet) {
      this.initialize();
    }
    return this.signerWallet.address;
  }

  /**
   * 生成过期时间（默认30分钟）
   */
  static generateDeadline(minutes: number = 30): number {
    return Math.floor(Date.now() / 1000) + (minutes * 60);
  }
}
