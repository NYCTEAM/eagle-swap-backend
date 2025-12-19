// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title NFTMiningWithSignature
 * @dev NFT 持有挖矿合约 - 使用签名验证方式
 * 
 * 优点：
 * 1. 零 Gas 同步成本 - 不需要同步社区数据到链上
 * 2. 灵活性高 - 后端可以随时调整加成规则
 * 3. 安全性好 - 签名由后端私钥生成，无法伪造
 * 
 * 流程：
 * 1. 用户请求领取奖励
 * 2. 后端计算奖励（含 NFT + VIP + 社区加成）
 * 3. 后端生成签名
 * 4. 用户提交签名到合约
 * 5. 合约验证签名后发放奖励
 */
contract NFTMiningWithSignature is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // ============================================
    // 状态变量
    // ============================================
    
    IERC20 public eagleToken;
    IERC721 public eagleNFT;
    
    // 签名验证者地址 (后端私钥对应的公钥地址)
    address public signer;
    
    // 用户已领取的奖励
    mapping(address => uint256) public totalClaimed;
    
    // 已使用的 nonce (防止重放攻击)
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    // 奖励池
    uint256 public rewardPool;
    
    // 统计
    uint256 public totalRewardsPaid;
    
    // ============================================
    // 事件
    // ============================================
    
    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event RewardPoolFunded(uint256 amount);
    
    // ============================================
    // 构造函数
    // ============================================
    
    constructor(
        address _eagleToken,
        address _eagleNFT,
        address _signer
    ) {
        eagleToken = IERC20(_eagleToken);
        eagleNFT = IERC721(_eagleNFT);
        signer = _signer;
    }
    
    // ============================================
    // 领取奖励 (签名验证)
    // ============================================
    
    /**
     * @dev 领取挖矿奖励
     * @param amount 总奖励金额 (已包含年度衰减 + 阶段衰减 + 社区加成)
     * @param nonce 唯一标识符 (防止重放)
     * @param deadline 签名过期时间
     * @param signature 后端签名
     */
    function claimReward(
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // 检查过期时间
        require(block.timestamp <= deadline, "Signature expired");
        
        // 检查 nonce 是否已使用
        require(!usedNonces[msg.sender][nonce], "Nonce already used");
        
        // 检查奖励池余额
        require(rewardPool >= amount, "Insufficient reward pool");
        
        // 验证签名（简化版，只包含必要参数）
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            amount,
            nonce,
            deadline,
            address(this), // 合约地址，防止跨合约重放
            block.chainid  // 链 ID，防止跨链重放
        ));
        
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        require(recoveredSigner == signer, "Invalid signature");
        
        // 标记 nonce 已使用
        usedNonces[msg.sender][nonce] = true;
        
        // 更新状态
        totalClaimed[msg.sender] += amount;
        rewardPool -= amount;
        totalRewardsPaid += amount;
        
        // 转账
        eagleToken.safeTransfer(msg.sender, amount);
        
        emit RewardClaimed(msg.sender, amount, nonce);
    }
    
    // ============================================
    // 查询函数
    // ============================================
    
    /**
     * @dev 检查 nonce 是否已使用
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }
    
    /**
     * @dev 获取用户信息
     */
    function getUserInfo(address user) external view returns (
        uint256 claimed,
        uint256 nftBalance
    ) {
        claimed = totalClaimed[user];
        nftBalance = eagleNFT.balanceOf(user);
    }
    
    // ============================================
    // 管理函数
    // ============================================
    
    /**
     * @dev 更新签名者地址
     */
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }
    
    /**
     * @dev 向奖励池注入资金
     */
    function fundRewardPool(uint256 amount) external onlyOwner {
        eagleToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }
    
    /**
     * @dev 紧急提取
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
