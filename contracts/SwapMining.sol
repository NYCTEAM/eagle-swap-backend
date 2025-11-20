// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SwapMining
 * @dev SWAP 交易挖矿合约
 * 每 1 USDT 交易 = 0.0003 EAGLE
 */
contract SwapMining is Ownable, ReentrancyGuard {
    
    // EAGLE Token 合约地址
    IERC20 public eagleToken;
    
    // 奖励比例: 0.0003 EAGLE per USDT
    uint256 public constant REWARD_RATE = 3; // 3/10000 = 0.0003
    uint256 public constant RATE_DENOMINATOR = 10000;
    
    // 手续费率: 0.1%
    uint256 public constant FEE_RATE = 10; // 10/10000 = 0.001
    
    // 用户统计
    struct UserStats {
        uint256 totalTrades;
        uint256 totalVolume;
        uint256 totalEagleEarned;
        uint256 totalEagleClaimed;
        uint256 lastTradeTime;
    }
    
    // 用户等级
    enum Tier { Bronze, Silver, Gold, Platinum }
    
    // 等级倍数
    mapping(Tier => uint256) public tierMultipliers;
    
    // 等级最低交易量要求
    mapping(Tier => uint256) public tierRequirements;
    
    // 用户数据
    mapping(address => UserStats) public userStats;
    
    // 用户待领取奖励
    mapping(address => uint256) public pendingRewards;
    
    // 推荐关系
    mapping(address => address) public referrers;
    
    // 推荐奖励比例: 10%
    uint256 public constant REFERRAL_RATE = 1000; // 10%
    
    // 是否启用
    bool public enabled = true;
    
    // 后端服务器地址（用于记录交易）
    address public backendServer;
    
    // 事件
    event SwapRecorded(
        address indexed user,
        uint256 tradeValue,
        uint256 fee,
        uint256 eagleReward,
        uint256 timestamp
    );
    
    event RewardClaimed(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event ReferralReward(
        address indexed referrer,
        address indexed referee,
        uint256 amount,
        uint256 timestamp
    );
    
    constructor(address _eagleToken, address _backendServer) {
        eagleToken = IERC20(_eagleToken);
        backendServer = _backendServer;
        
        // 初始化等级倍数
        tierMultipliers[Tier.Bronze] = 10000;    // 1.0x
        tierMultipliers[Tier.Silver] = 12000;    // 1.2x
        tierMultipliers[Tier.Gold] = 15000;      // 1.5x
        tierMultipliers[Tier.Platinum] = 20000;  // 2.0x
        
        // 初始化等级要求
        tierRequirements[Tier.Bronze] = 0;
        tierRequirements[Tier.Silver] = 1000 * 1e18;      // 1,000 USDT
        tierRequirements[Tier.Gold] = 10000 * 1e18;       // 10,000 USDT
        tierRequirements[Tier.Platinum] = 100000 * 1e18;  // 100,000 USDT
    }
    
    /**
     * @dev 记录交易并计算奖励
     * @param user 用户地址
     * @param tradeValue 交易金额（USDT，18位小数）
     */
    function recordSwap(address user, uint256 tradeValue) external nonReentrant {
        require(enabled, "SwapMining: disabled");
        require(msg.sender == backendServer, "SwapMining: only backend");
        require(user != address(0), "SwapMining: invalid user");
        require(tradeValue > 0, "SwapMining: invalid trade value");
        
        // 计算基础奖励
        uint256 baseReward = (tradeValue * REWARD_RATE) / RATE_DENOMINATOR;
        
        // 获取用户等级
        Tier userTier = getUserTier(user);
        
        // 应用等级倍数
        uint256 reward = (baseReward * tierMultipliers[userTier]) / 10000;
        
        // 更新用户统计
        UserStats storage stats = userStats[user];
        stats.totalTrades++;
        stats.totalVolume += tradeValue;
        stats.totalEagleEarned += reward;
        stats.lastTradeTime = block.timestamp;
        
        // 添加到待领取奖励
        pendingRewards[user] += reward;
        
        // 计算手续费
        uint256 fee = (tradeValue * FEE_RATE) / RATE_DENOMINATOR;
        
        emit SwapRecorded(user, tradeValue, fee, reward, block.timestamp);
        
        // 处理推荐奖励
        address referrer = referrers[user];
        if (referrer != address(0)) {
            uint256 referralReward = (reward * REFERRAL_RATE) / 10000;
            pendingRewards[referrer] += referralReward;
            
            UserStats storage referrerStats = userStats[referrer];
            referrerStats.totalEagleEarned += referralReward;
            
            emit ReferralReward(referrer, user, referralReward, block.timestamp);
        }
    }
    
    /**
     * @dev 领取奖励
     */
    function claimRewards() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "SwapMining: no pending rewards");
        
        // 重置待领取奖励
        pendingRewards[msg.sender] = 0;
        
        // 更新已领取统计
        userStats[msg.sender].totalEagleClaimed += amount;
        
        // 转账 EAGLE
        require(
            eagleToken.transfer(msg.sender, amount),
            "SwapMining: transfer failed"
        );
        
        emit RewardClaimed(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev 设置推荐人
     * @param referrer 推荐人地址
     */
    function setReferrer(address referrer) external {
        require(referrers[msg.sender] == address(0), "SwapMining: referrer already set");
        require(referrer != address(0), "SwapMining: invalid referrer");
        require(referrer != msg.sender, "SwapMining: cannot refer yourself");
        
        referrers[msg.sender] = referrer;
    }
    
    /**
     * @dev 获取用户等级
     * @param user 用户地址
     * @return 用户等级
     */
    function getUserTier(address user) public view returns (Tier) {
        uint256 volume = userStats[user].totalVolume;
        
        if (volume >= tierRequirements[Tier.Platinum]) {
            return Tier.Platinum;
        } else if (volume >= tierRequirements[Tier.Gold]) {
            return Tier.Gold;
        } else if (volume >= tierRequirements[Tier.Silver]) {
            return Tier.Silver;
        } else {
            return Tier.Bronze;
        }
    }
    
    /**
     * @dev 获取用户统计
     * @param user 用户地址
     */
    function getUserStats(address user) external view returns (
        uint256 totalTrades,
        uint256 totalVolume,
        uint256 totalEagleEarned,
        uint256 totalEagleClaimed,
        uint256 pending,
        Tier tier
    ) {
        UserStats memory stats = userStats[user];
        return (
            stats.totalTrades,
            stats.totalVolume,
            stats.totalEagleEarned,
            stats.totalEagleClaimed,
            pendingRewards[user],
            getUserTier(user)
        );
    }
    
    /**
     * @dev 设置后端服务器地址
     * @param _backendServer 新的后端服务器地址
     */
    function setBackendServer(address _backendServer) external onlyOwner {
        require(_backendServer != address(0), "SwapMining: invalid address");
        backendServer = _backendServer;
    }
    
    /**
     * @dev 启用/禁用挖矿
     * @param _enabled 是否启用
     */
    function setEnabled(bool _enabled) external onlyOwner {
        enabled = _enabled;
    }
    
    /**
     * @dev 紧急提取 EAGLE（仅限 owner）
     * @param amount 提取数量
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(
            eagleToken.transfer(owner(), amount),
            "SwapMining: transfer failed"
        );
    }
}
