import { ethers } from 'ethers';
import { logger } from './logger';

/**
 * 自定义 RPC Provider
 * 专门为 EagleSwap RPC 设计，避免自动网络检测
 */
export class CustomRpcProvider extends ethers.JsonRpcProvider {
  constructor(url: string, chainId: number = 196) {
    // 创建网络配置
    const network = new ethers.Network('xlayer', chainId);
    
    // 调用父类构造函数，传入网络配置
    super(url, network, {
      staticNetwork: network,
      batchMaxCount: 1, // 禁用批量请求
    });

    logger.info('Custom RPC Provider initialized', { url, chainId });
  }

  /**
   * 重写 _detectNetwork 方法，避免自动检测
   */
  override async _detectNetwork(): Promise<ethers.Network> {
    // 直接返回预设的网络，不进行检测
    return new ethers.Network('xlayer', 196);
  }

  /**
   * 重写 send 方法，添加错误处理
   */
  override async send(method: string, params: Array<any>): Promise<any> {
    try {
      return await super.send(method, params);
    } catch (error: any) {
      logger.error('RPC request failed', {
        method,
        params: params.slice(0, 2), // 只记录前2个参数，避免日志过长
        error: error.message,
      });
      throw error;
    }
  }
}

/**
 * 创建自定义 RPC Provider
 */
export function createCustomProvider(rpcUrl?: string): CustomRpcProvider {
  const url = rpcUrl || process.env.CUSTOM_RPC_URL || 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd';
  return new CustomRpcProvider(url, 196);
}
