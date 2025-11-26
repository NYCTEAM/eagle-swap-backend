// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapMiningRewards
 * @dev SWAP Mining rewards contract. Users claim rewards with backend signature verification.
 * 
 * Signer Address: 0x81a3c6a791fce80015ba2236587bdb667e8ac7b9
 */
contract SwapMiningRewards is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // EAGLE Token contract
    IERC20 public eagleToken;

    // Signer address (Backend wallet public key)
    address public signerAddress;

    // Track claimed nonces to prevent replay attacks
    mapping(address => uint256) public userNonce;

    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed newSigner);
    event EagleTokenUpdated(address indexed oldToken, address indexed newToken);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    constructor(address _eagleToken, address _signer) Ownable(msg.sender) {
        eagleToken = IERC20(_eagleToken);
        signerAddress = _signer;
    }

    /**
     * @dev Claim accumulated rewards
     * @param amount Amount of EAGLE to claim (in wei)
     * @param deadline Expiration timestamp for the signature
     * @param signature Backend signature
     */
    function claim(
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Signature expired");
        require(amount > 0, "Amount must be > 0");

        // Get user's current nonce
        uint256 nonce = userNonce[msg.sender];

        // Verify Signature
        // Message: (userAddress, amount, nonce, deadline, chainId, contractAddress)
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                amount,
                nonce,
                deadline,
                block.chainid,
                address(this)
            )
        );
        
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, signature);

        require(recoveredSigner == signerAddress, "Invalid signature");

        // Update state BEFORE transfer (Checks-Effects-Interactions)
        userNonce[msg.sender]++;

        // Transfer EAGLE
        require(eagleToken.transfer(msg.sender, amount), "Transfer failed");

        emit RewardClaimed(msg.sender, amount, nonce);
    }

    // ============ Admin Functions ============

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer address");
        signerAddress = _signer;
        emit SignerUpdated(_signer);
    }

    /**
     * @dev Update EAGLE token contract address (Owner only)
     * @param _newEagleToken New EAGLE token contract address
     */
    function setEagleToken(address _newEagleToken) external onlyOwner {
        require(_newEagleToken != address(0), "Invalid token address");
        require(_newEagleToken != address(eagleToken), "Same token address");
        
        address oldToken = address(eagleToken);
        eagleToken = IERC20(_newEagleToken);
        
        emit EagleTokenUpdated(oldToken, _newEagleToken);
    }

    /**
     * @dev Withdraw EAGLE tokens (Owner only)
     * @param amount Amount to withdraw (in wei)
     */
    function withdrawEagle(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        require(eagleToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        require(eagleToken.transfer(msg.sender, amount), "Transfer failed");
        emit EmergencyWithdraw(address(eagleToken), amount);
    }

    /**
     * @dev Withdraw all EAGLE tokens (Owner only)
     */
    function withdrawAllEagle() external onlyOwner {
        uint256 balance = eagleToken.balanceOf(address(this));
        require(balance > 0, "No EAGLE to withdraw");
        
        require(eagleToken.transfer(msg.sender, balance), "Transfer failed");
        emit EmergencyWithdraw(address(eagleToken), balance);
    }

    /**
     * @dev Withdraw any ERC20 token (Owner only) - Emergency function
     * @param _token Token contract address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be > 0");
        
        IERC20(_token).transfer(msg.sender, _amount);
        emit EmergencyWithdraw(_token, _amount);
    }

    /**
     * @dev Get contract EAGLE balance
     */
    function getEagleBalance() external view returns (uint256) {
        return eagleToken.balanceOf(address(this));
    }
}
