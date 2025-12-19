// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Eagle Swap Mining Distributor V2
 * @notice Secure signature-based reward distribution with reentrancy protection
 * @dev Uses Checks-Effects-Interactions pattern and SafeERC20
 * @dev Added: setRewardToken, pause/unpause, improved owner functions
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        require(address(token) != address(0), "Invalid token address");
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSelector(token.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SafeERC20: transfer failed");
    }
    
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        require(address(token) != address(0), "Invalid token address");
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSelector(token.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SafeERC20: transferFrom failed");
    }
}

contract SwapMiningV2 {
    using SafeERC20 for IERC20;

    address public owner;
    address public pendingOwner; // 两步转让所有权
    address public signer; // Backend wallet that signs the claim data
    IERC20 public rewardToken; // 可更改的奖励代币
    bool public paused; // 暂停功能

    // Gas optimization: combine nonce and totalClaimed in one struct
    struct UserData {
        uint256 nonce;
        uint256 totalClaimed;
    }
    
    mapping(address => UserData) public userData;
    
    // 统计数据
    uint256 public totalDistributed;

    // Events
    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce, uint256 deadline);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event RewardTokenUpdated(address indexed oldToken, address indexed newToken);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event RewardPoolFunded(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    constructor(address _rewardToken, address _signer) {
        require(_rewardToken != address(0), "Invalid token");
        require(_signer != address(0), "Invalid signer");
        owner = msg.sender;
        rewardToken = IERC20(_rewardToken);
        signer = _signer;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the signer address
     */
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }
    
    /**
     * @notice Update the reward token address
     */
    function setRewardToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token");
        emit RewardTokenUpdated(address(rewardToken), _token);
        rewardToken = IERC20(_token);
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Start ownership transfer (two-step process)
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }
    
    /**
     * @notice Accept ownership transfer
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
    
    /**
     * @notice Withdraw any token from contract (emergency)
     */
    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        IERC20(token).safeTransfer(to, amount);
        emit TokensWithdrawn(token, to, amount);
    }
    
    /**
     * @notice Withdraw reward token from contract
     */
    function withdrawRewardToken(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        rewardToken.safeTransfer(owner, amount);
        emit TokensWithdrawn(address(rewardToken), owner, amount);
    }
    
    /**
     * @notice Fund the reward pool (owner deposits tokens)
     */
    function fundRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardPoolFunded(msg.sender, amount);
    }

    // ============ Signature Verification ============

    /**
     * @notice Generate message hash for signature verification
     * @dev Uses abi.encode to prevent hash collision attacks
     */
    function getMessageHash(
        address user, 
        uint256 amount, 
        uint256 nonce, 
        uint256 deadline
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(user, amount, nonce, deadline));
    }

    function getEthSignedMessageHash(bytes32 _messageHash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
    }

    function verify(
        address user, 
        uint256 amount, 
        uint256 nonce, 
        uint256 deadline, 
        bytes memory signature
    ) public view returns (bool) {
        bytes32 messageHash = getMessageHash(user, amount, nonce, deadline);
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);
        return recoverSigner(ethSignedMessageHash, signature) == signer;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    // ============ Claim Function ============

    /**
     * @notice Claim rewards with backend signature
     * @dev Follows Checks-Effects-Interactions pattern to prevent reentrancy
     * @param amount Amount to claim (in wei)
     * @param nonce User's current nonce (prevents replay attacks)
     * @param deadline Signature expiration timestamp
     * @param signature Backend-generated signature
     */
    function claim(
        uint256 amount, 
        uint256 nonce, 
        uint256 deadline, 
        bytes calldata signature
    ) external whenNotPaused {
        // Checks
        require(block.timestamp <= deadline, "Signature expired");
        require(nonce == userData[msg.sender].nonce, "Invalid nonce");
        require(amount > 0, "Amount must be > 0");
        require(verify(msg.sender, amount, nonce, deadline, signature), "Invalid signature");
        
        // Check contract has enough balance
        uint256 balance = rewardToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient reward pool");
        
        // Effects (update state BEFORE external call to prevent reentrancy)
        userData[msg.sender].nonce++;
        userData[msg.sender].totalClaimed += amount;
        totalDistributed += amount;
        
        // Interactions (external call last)
        rewardToken.safeTransfer(msg.sender, amount);
        
        emit RewardClaimed(msg.sender, amount, nonce, deadline);
    }

    // ============ View Functions ============

    function getNonce(address user) external view returns (uint256) {
        return userData[user].nonce;
    }
    
    function getTotalClaimed(address user) external view returns (uint256) {
        return userData[user].totalClaimed;
    }
    
    function getRewardPoolBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
    
    function getContractInfo() external view returns (
        address tokenAddress,
        address signerAddress,
        address ownerAddress,
        uint256 poolBalance,
        uint256 totalPaid,
        bool isPaused
    ) {
        return (
            address(rewardToken),
            signer,
            owner,
            rewardToken.balanceOf(address(this)),
            totalDistributed,
            paused
        );
    }
}
