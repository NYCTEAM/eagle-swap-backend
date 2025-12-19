// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract NFTMiningWithSignature is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public rewardToken;
    address public signer;
    mapping(address => uint256) public totalClaimed;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    uint256 public rewardPool;
    uint256 public totalRewardsPaid;

    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event RewardTokenUpdated(address indexed oldToken, address indexed newToken);
    event RewardPoolFunded(uint256 amount);
    event RewardPoolWithdrawn(uint256 amount);

    constructor(address _rewardToken, address _signer) Ownable(msg.sender) {
        require(_rewardToken != address(0), "Invalid token");
        require(_signer != address(0), "Invalid signer");
        rewardToken = IERC20(_rewardToken);
        signer = _signer;
    }

    function claimReward(
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        require(!usedNonces[msg.sender][nonce], "Nonce already used");
        require(rewardPool >= amount, "Insufficient reward pool");

        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            amount,
            nonce,
            deadline,
            address(this),
            block.chainid
        ));

        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(recoveredSigner == signer, "Invalid signature");

        usedNonces[msg.sender][nonce] = true;
        totalClaimed[msg.sender] += amount;
        rewardPool -= amount;
        totalRewardsPaid += amount;

        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardClaimed(msg.sender, amount, nonce);
    }

    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    function getUserClaimed(address user) external view returns (uint256) {
        return totalClaimed[user];
    }

    function getContractInfo() external view returns (
        address tokenAddress,
        address signerAddress,
        uint256 poolBalance,
        uint256 totalPaid
    ) {
        return (address(rewardToken), signer, rewardPool, totalRewardsPaid);
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setRewardToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token");
        emit RewardTokenUpdated(address(rewardToken), _token);
        rewardToken = IERC20(_token);
    }

    function fundRewardPool(uint256 amount) external onlyOwner {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }

    function withdrawRewardPool(uint256 amount) external onlyOwner {
        require(amount <= rewardPool, "Insufficient pool");
        rewardPool -= amount;
        rewardToken.safeTransfer(owner(), amount);
        emit RewardPoolWithdrawn(amount);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        _transferOwnership(newOwner);
    }
}
