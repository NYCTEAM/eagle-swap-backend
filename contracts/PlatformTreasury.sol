// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PlatformTreasury
 * @notice 平台资金管理合约（简化版）
 * @dev 用于管理 EAGLE SWAP 平台资金
 * 
 * 功能:
 * 1. 接收资金（ETH 和 ERC20）
 * 2. 提取资金
 * 3. 查询余额
 * 4. 多管理员权限
 */
contract PlatformTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 状态变量 ============

    /// @notice 授权的管理员地址（可以提取资金）
    mapping(address => bool) public admins;

    // ============ 事件 ============

    event FundsDeposited(
        address indexed token,
        address indexed from,
        uint256 amount
    );

    event FundsWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    event AdminUpdated(address indexed admin, bool status);

    // ============ 修饰符 ============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }

    // ============ 构造函数 ============

    constructor() {
        // 部署者自动成为管理员
        admins[msg.sender] = true;
    }

    // ============ 核心功能 ============

    /**
     * @notice 存入资金
     * @param token 代币地址 (0x0 表示 ETH)
     * @param amount 存入金额
     */
    function deposit(address token, uint256 amount) external payable nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        if (token == address(0)) {
            // ETH
            require(msg.value == amount, "ETH amount mismatch");
        } else {
            // ERC20
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        emit FundsDeposited(token, msg.sender, amount);
    }

    /**
     * @notice 提取资金
     * @param token 代币地址 (0x0 表示 ETH)
     * @param to 接收地址
     * @param amount 提取金额
     */
    function withdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyAdmin nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        if (token == address(0)) {
            // ETH
            require(address(this).balance >= amount, "Insufficient ETH balance");
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20
            IERC20(token).safeTransfer(to, amount);
        }

        emit FundsWithdrawn(token, to, amount);
    }

    /**
     * @notice 提取所有余额
     * @param token 代币地址
     * @param to 接收地址
     */
    function withdrawAll(address token, address to) external onlyAdmin nonReentrant {
        require(to != address(0), "Invalid recipient");

        uint256 balance;
        if (token == address(0)) {
            balance = address(this).balance;
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }

        require(balance > 0, "No balance to withdraw");

        if (token == address(0)) {
            (bool success, ) = payable(to).call{value: balance}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, balance);
        }

        emit FundsWithdrawn(token, to, balance);
    }

    // ============ 管理功能 ============

    /**
     * @notice 设置管理员权限
     * @param admin 管理员地址
     * @param status 授权状态
     */
    function setAdmin(address admin, bool status) external onlyOwner {
        require(admin != address(0), "Invalid admin");
        admins[admin] = status;
        emit AdminUpdated(admin, status);
    }

    /**
     * @notice 批量设置管理员
     * @param _admins 管理员地址数组
     * @param statuses 授权状态数组
     */
    function setAdminBatch(
        address[] calldata _admins,
        bool[] calldata statuses
    ) external onlyOwner {
        require(_admins.length == statuses.length, "Array length mismatch");

        for (uint256 i = 0; i < _admins.length; i++) {
            admins[_admins[i]] = statuses[i];
            emit AdminUpdated(_admins[i], statuses[i]);
        }
    }

    // ============ 查询功能 ============

    /**
     * @notice 查询代币余额
     * @param token 代币地址 (0x0 表示 ETH)
     * @return balance 余额
     */
    function getBalance(address token) external view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @notice 查询多个代币余额
     * @param tokens 代币地址数组
     * @return balances 余额数组
     */
    function getBalances(address[] calldata tokens) external view returns (uint256[] memory) {
        uint256[] memory balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                balances[i] = address(this).balance;
            } else {
                balances[i] = IERC20(tokens[i]).balanceOf(address(this));
            }
        }
        return balances;
    }

    // ============ 接收 ETH ============

    receive() external payable {
        emit FundsDeposited(address(0), msg.sender, msg.value);
    }
}
