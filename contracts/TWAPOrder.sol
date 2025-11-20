// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TWAPOrder
 * @notice Time-Weighted Average Price 订单合约
 * @dev 将大额订单拆分成多个小订单，在指定时间间隔内执行
 */
contract TWAPOrder is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Order {
        address user;           // 用户地址
        address tokenIn;        // 输入代币
        address tokenOut;       // 输出代币
        uint256 totalAmount;    // 总金额
        uint256 amountPerTrade; // 每笔交易金额
        uint256 totalTrades;    // 总交易数
        uint256 executedTrades; // 已执行交易数
        uint256 tradeInterval;  // 交易间隔（秒）
        uint256 lastExecuteTime;// 上次执行时间
        uint256 maxDuration;    // 最大持续时间
        uint256 createdAt;      // 创建时间
        uint256 minAmountOut;   // 最小输出金额（限价）
        bool isMarketOrder;     // 是否市价单
        bool isActive;          // 是否激活
    }

    // 订单ID => 订单
    mapping(uint256 => Order) public orders;
    
    // 用户地址 => 订单ID列表
    mapping(address => uint256[]) public userOrders;
    
    // 订单计数器
    uint256 public orderCounter;
    
    // DEX Router 地址
    address public dexRouter;
    
    // 平台手续费率 (0.1% = 10 basis points)
    uint256 public platformFeeRate = 10;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // 平台 Treasury 地址
    address public platformTreasury;
    
    // 最小交易间隔（秒）
    uint256 public constant MIN_TRADE_INTERVAL = 120; // 2 分钟
    
    // 执行者奖励比例
    uint256 public executorRewardRate = 5; // 0.05%

    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 totalAmount,
        uint256 totalTrades
    );

    event TradeExecuted(
        uint256 indexed orderId,
        uint256 tradeNumber,
        uint256 amountIn,
        uint256 amountOut,
        address executor
    );

    event OrderCancelled(uint256 indexed orderId, uint256 refundAmount);
    event OrderCompleted(uint256 indexed orderId);

    constructor(address _dexRouter, address _platformTreasury) {
        dexRouter = _dexRouter;
        platformTreasury = _platformTreasury;
    }

    /**
     * @notice 创建 TWAP 订单
     * @param tokenIn 输入代币地址
     * @param tokenOut 输出代币地址
     * @param totalAmount 总金额
     * @param totalTrades 总交易数
     * @param tradeInterval 交易间隔（秒）
     * @param maxDuration 最大持续时间（秒）
     * @param minAmountOut 最小输出金额（0 表示市价单）
     */
    function createOrder(
        address tokenIn,
        address tokenOut,
        uint256 totalAmount,
        uint256 totalTrades,
        uint256 tradeInterval,
        uint256 maxDuration,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256) {
        require(totalAmount > 0, "Invalid amount");
        require(totalTrades > 0 && totalTrades <= 100, "Invalid trades count");
        require(tradeInterval >= MIN_TRADE_INTERVAL, "Interval too short");
        require(maxDuration >= tradeInterval * totalTrades, "Duration too short");

        // 转入代币
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), totalAmount);

        // 创建订单
        uint256 orderId = orderCounter++;
        uint256 amountPerTrade = totalAmount / totalTrades;

        orders[orderId] = Order({
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            totalAmount: totalAmount,
            amountPerTrade: amountPerTrade,
            totalTrades: totalTrades,
            executedTrades: 0,
            tradeInterval: tradeInterval,
            lastExecuteTime: 0,
            maxDuration: maxDuration,
            createdAt: block.timestamp,
            minAmountOut: minAmountOut,
            isMarketOrder: minAmountOut == 0,
            isActive: true
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            tokenIn,
            tokenOut,
            totalAmount,
            totalTrades
        );

        return orderId;
    }

    /**
     * @notice 执行 TWAP 订单的下一笔交易
     * @param orderId 订单ID
     */
    function executeNextTrade(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.isActive, "Order not active");
        require(order.executedTrades < order.totalTrades, "All trades executed");
        
        // 检查时间间隔
        if (order.executedTrades > 0) {
            require(
                block.timestamp >= order.lastExecuteTime + order.tradeInterval,
                "Too early"
            );
        }
        
        // 检查是否过期
        require(
            block.timestamp <= order.createdAt + order.maxDuration,
            "Order expired"
        );

        // 计算本次交易金额
        uint256 amountIn = order.amountPerTrade;
        
        // 如果是最后一笔，使用剩余所有金额
        if (order.executedTrades == order.totalTrades - 1) {
            amountIn = order.totalAmount - (order.amountPerTrade * order.executedTrades);
        }

        // 计算平台手续费
        uint256 platformFee = (amountIn * platformFeeRate) / FEE_DENOMINATOR;
        uint256 amountAfterFee = amountIn - platformFee;

        // 转账手续费到 Treasury
        IERC20(order.tokenIn).safeTransfer(platformTreasury, platformFee);

        // 授权 DEX Router
        IERC20(order.tokenIn).safeApprove(dexRouter, amountAfterFee);

        // 执行 Swap（这里需要根据实际 DEX 接口调整）
        // 示例：调用 Uniswap V2 风格的 Router
        address[] memory path = new address[](2);
        path[0] = order.tokenIn;
        path[1] = order.tokenOut;

        uint256[] memory amounts = IRouter(dexRouter).swapExactTokensForTokens(
            amountAfterFee,
            order.minAmountOut, // 最小输出
            path,
            order.user, // 直接发送给用户
            block.timestamp + 300
        );

        // 计算执行者奖励
        uint256 executorReward = (amounts[1] * executorRewardRate) / FEE_DENOMINATOR;
        if (executorReward > 0) {
            IERC20(order.tokenOut).safeTransferFrom(order.user, msg.sender, executorReward);
        }

        // 更新订单状态
        order.executedTrades++;
        order.lastExecuteTime = block.timestamp;

        emit TradeExecuted(
            orderId,
            order.executedTrades,
            amountIn,
            amounts[1],
            msg.sender
        );

        // 如果所有交易都执行完成
        if (order.executedTrades == order.totalTrades) {
            order.isActive = false;
            emit OrderCompleted(orderId);
        }
    }

    /**
     * @notice 取消订单并退款
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.user == msg.sender, "Not order owner");
        require(order.isActive, "Order not active");

        // 计算剩余金额
        uint256 remainingAmount = order.totalAmount - (order.amountPerTrade * order.executedTrades);
        
        if (remainingAmount > 0) {
            IERC20(order.tokenIn).safeTransfer(msg.sender, remainingAmount);
        }

        order.isActive = false;

        emit OrderCancelled(orderId, remainingAmount);
    }

    /**
     * @notice 获取用户的所有订单
     * @param user 用户地址
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /**
     * @notice 获取订单详情
     * @param orderId 订单ID
     */
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /**
     * @notice 检查订单是否可以执行下一笔交易
     * @param orderId 订单ID
     */
    function canExecuteNextTrade(uint256 orderId) external view returns (bool) {
        Order memory order = orders[orderId];
        
        if (!order.isActive) return false;
        if (order.executedTrades >= order.totalTrades) return false;
        if (block.timestamp > order.createdAt + order.maxDuration) return false;
        
        if (order.executedTrades > 0) {
            if (block.timestamp < order.lastExecuteTime + order.tradeInterval) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * @notice 更新 DEX Router 地址
     */
    function setDexRouter(address _dexRouter) external onlyOwner {
        dexRouter = _dexRouter;
    }

    /**
     * @notice 更新平台手续费率
     */
    function setPlatformFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 100, "Fee too high"); // 最大 1%
        platformFeeRate = _feeRate;
    }

    /**
     * @notice 更新 Treasury 地址
     */
    function setPlatformTreasury(address _treasury) external onlyOwner {
        platformTreasury = _treasury;
    }
}

// Router 接口
interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
