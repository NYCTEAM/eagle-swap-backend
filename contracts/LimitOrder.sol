// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title LimitOrder
 * @notice 限价订单合约
 * @dev 用户设置目标价格，当市场价格达到时自动执行
 */
contract LimitOrder is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Order {
        address user;           // 用户地址
        address tokenIn;        // 输入代币
        address tokenOut;       // 输出代币
        uint256 amountIn;       // 输入金额
        uint256 minAmountOut;   // 最小输出金额（限价）
        uint256 limitPrice;     // 限价（tokenOut per tokenIn，18位精度）
        uint256 expiryTime;     // 过期时间
        uint256 createdAt;      // 创建时间
        bool isActive;          // 是否激活
        bool isFilled;          // 是否已成交
    }

    // 订单ID => 订单
    mapping(uint256 => Order) public orders;
    
    // 用户地址 => 订单ID列表
    mapping(address => uint256[]) public userOrders;
    
    // 订单计数器
    uint256 public orderCounter;
    
    // DEX Router 地址
    address public dexRouter;
    
    // 价格预言机地址（可选）
    address public priceOracle;
    
    // 平台手续费率 (0.1% = 10 basis points)
    uint256 public platformFeeRate = 10;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // 平台 Treasury 地址
    address public platformTreasury;
    
    // 执行者奖励比例
    uint256 public executorRewardRate = 5; // 0.05%

    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 limitPrice,
        uint256 expiryTime
    );

    event OrderFilled(
        uint256 indexed orderId,
        uint256 amountIn,
        uint256 amountOut,
        address executor
    );

    event OrderCancelled(uint256 indexed orderId, uint256 refundAmount);

    constructor(address _dexRouter, address _platformTreasury) {
        dexRouter = _dexRouter;
        platformTreasury = _platformTreasury;
    }

    /**
     * @notice 创建限价订单
     * @param tokenIn 输入代币地址
     * @param tokenOut 输出代币地址
     * @param amountIn 输入金额
     * @param limitPrice 限价（tokenOut per tokenIn，18位精度）
     * @param expiryDuration 过期时长（秒）
     */
    function createOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 limitPrice,
        uint256 expiryDuration
    ) external nonReentrant returns (uint256) {
        require(amountIn > 0, "Invalid amount");
        require(limitPrice > 0, "Invalid price");
        require(expiryDuration > 0, "Invalid expiry");

        // 转入代币
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // 计算最小输出金额
        uint256 minAmountOut = (amountIn * limitPrice) / 1e18;

        // 创建订单
        uint256 orderId = orderCounter++;
        uint256 expiryTime = block.timestamp + expiryDuration;

        orders[orderId] = Order({
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            limitPrice: limitPrice,
            expiryTime: expiryTime,
            createdAt: block.timestamp,
            isActive: true,
            isFilled: false
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            limitPrice,
            expiryTime
        );

        return orderId;
    }

    /**
     * @notice 执行限价订单
     * @param orderId 订单ID
     */
    function fillOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.isActive, "Order not active");
        require(!order.isFilled, "Order already filled");
        require(block.timestamp <= order.expiryTime, "Order expired");

        // 检查当前价格是否满足限价条件
        uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
        require(currentPrice >= order.limitPrice, "Price not reached");

        // 计算平台手续费
        uint256 platformFee = (order.amountIn * platformFeeRate) / FEE_DENOMINATOR;
        uint256 amountAfterFee = order.amountIn - platformFee;

        // 转账手续费到 Treasury
        IERC20(order.tokenIn).safeTransfer(platformTreasury, platformFee);

        // 授权 DEX Router
        IERC20(order.tokenIn).safeApprove(dexRouter, amountAfterFee);

        // 执行 Swap
        address[] memory path = new address[](2);
        path[0] = order.tokenIn;
        path[1] = order.tokenOut;

        uint256[] memory amounts = IRouter(dexRouter).swapExactTokensForTokens(
            amountAfterFee,
            order.minAmountOut,
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
        order.isActive = false;
        order.isFilled = true;

        emit OrderFilled(orderId, order.amountIn, amounts[1], msg.sender);
    }

    /**
     * @notice 取消订单并退款
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.user == msg.sender, "Not order owner");
        require(order.isActive, "Order not active");
        require(!order.isFilled, "Order already filled");

        // 退款
        IERC20(order.tokenIn).safeTransfer(msg.sender, order.amountIn);

        // 更新状态
        order.isActive = false;

        emit OrderCancelled(orderId, order.amountIn);
    }

    /**
     * @notice 获取当前价格（从 DEX 或预言机）
     * @param tokenIn 输入代币
     * @param tokenOut 输出代币
     * @return price 价格（18位精度）
     */
    function getCurrentPrice(address tokenIn, address tokenOut) public view returns (uint256) {
        // 如果有价格预言机，优先使用
        if (priceOracle != address(0)) {
            return IPriceOracle(priceOracle).getPrice(tokenIn, tokenOut);
        }

        // 否则从 DEX 获取价格
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = IRouter(dexRouter).getAmountsOut(1e18, path);
        return amounts[1];
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
     * @notice 检查订单是否可以执行
     * @param orderId 订单ID
     */
    function canFillOrder(uint256 orderId) external view returns (bool) {
        Order memory order = orders[orderId];
        
        if (!order.isActive) return false;
        if (order.isFilled) return false;
        if (block.timestamp > order.expiryTime) return false;
        
        uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
        if (currentPrice < order.limitPrice) return false;
        
        return true;
    }

    /**
     * @notice 批量检查可执行的订单
     * @param orderIds 订单ID数组
     */
    function getExecutableOrders(uint256[] calldata orderIds) external view returns (uint256[] memory) {
        uint256 count = 0;
        uint256[] memory temp = new uint256[](orderIds.length);
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            Order memory order = orders[orderIds[i]];
            
            if (order.isActive && !order.isFilled && block.timestamp <= order.expiryTime) {
                uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
                if (currentPrice >= order.limitPrice) {
                    temp[count] = orderIds[i];
                    count++;
                }
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        
        return result;
    }

    /**
     * @notice 清理过期订单（退款）
     * @param orderId 订单ID
     */
    function cleanupExpiredOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.isActive, "Order not active");
        require(!order.isFilled, "Order already filled");
        require(block.timestamp > order.expiryTime, "Order not expired");

        // 退款给用户
        IERC20(order.tokenIn).safeTransfer(order.user, order.amountIn);

        // 更新状态
        order.isActive = false;

        emit OrderCancelled(orderId, order.amountIn);
    }

    /**
     * @notice 更新 DEX Router 地址
     */
    function setDexRouter(address _dexRouter) external onlyOwner {
        dexRouter = _dexRouter;
    }

    /**
     * @notice 更新价格预言机地址
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        priceOracle = _priceOracle;
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

    /**
     * @notice 更新执行者奖励比例
     */
    function setExecutorRewardRate(uint256 _rate) external onlyOwner {
        require(_rate <= 50, "Reward too high"); // 最大 0.5%
        executorRewardRate = _rate;
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

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

// 价格预言机接口
interface IPriceOracle {
    function getPrice(address tokenIn, address tokenOut) external view returns (uint256);
}
