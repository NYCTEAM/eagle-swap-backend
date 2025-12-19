// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// Interface for bridge-compatible ERC20 tokens
interface IBridgeableERC20 is IERC20 {
    function bridgeIn(address to, uint256 amount) external;
    function bridgeOut(uint256 amount) external;
    function burn(uint256 amount) external;
}

/**
 * @title EagleBridge
 * @notice Secure Cross-Chain Bridge with signature verification
 * @dev Lock/Unlock (X Layer) and Burn/Mint (BSC) with multi-layer security
 */
contract EagleBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Associated token contract (immutable for security)
    IERC20 public immutable token;
    IBridgeableERC20 public immutable bridgeableToken;
    
    // Mode switch (immutable - set at deployment)
    // true = BSC (Destination): Burn on bridge-out, Mint on bridge-in
    // false = X Layer (Source): Lock on bridge-out, Unlock on bridge-in
    bool public immutable isMintMode;
    
    // Fee configuration
    address public feeWallet;
    uint256 public feeRate; // Current fee rate (in basis points, max 100 = 1%)
    uint256 public constant MAX_FEE_RATE = 100; // Maximum 1% (100/10000)
    uint256 public constant DENOMINATOR = 10000;
    
    // Anti-dust attack: Minimum bridge amount
    uint256 public minBridgeAmount = 1000 * 10**18; // Default: 1000 EAGLE
    uint256 public constant MIN_BRIDGE_FLOOR = 100 * 10**18; // Cannot set below 100 EAGLE

    // Signature verification
    address public relayer; // Authorized relayer address for signature verification
    uint256 public sourceChainId; // Source chain ID for cross-chain verification
    
    // Events
    event BridgeInitiated(
        address indexed from, 
        address indexed to, 
        uint256 amount, 
        uint256 fee, 
        uint256 indexed nonce,
        uint256 timestamp
    );
    event BridgeFinalized(address indexed to, uint256 amount, uint256 indexed nonce);
    event FeeWalletUpdated(address newWallet);
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event MinBridgeAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event RelayerUpdated(address oldRelayer, address newRelayer);
    event EmergencyWithdraw(address token, uint256 amount, address to);

    // Anti-replay nonce
    uint256 public nonce;
    mapping(uint256 => bool) public processedNonces;
    
    // Pause mechanism
    bool public paused;
    
    modifier whenNotPaused() {
        require(!paused, "Bridge is paused");
        _;
    }

    constructor(
        address _token, 
        bool _isMintMode, 
        address _feeWallet,
        address _relayer,
        uint256 _sourceChainId
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token");
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_relayer != address(0), "Invalid relayer");
        
        token = IERC20(_token);
        bridgeableToken = IBridgeableERC20(_token);
        isMintMode = _isMintMode;
        feeWallet = _feeWallet;
        relayer = _relayer;
        sourceChainId = _sourceChainId;
        feeRate = MAX_FEE_RATE; // Default to 1%
    }

    /**
     * @notice User calls this function to initiate cross-chain transfer
     * @param to Recipient address on destination chain
     * @param amount Total amount to bridge (user approves exact amount, not unlimited)
     */
    function bridge(address to, uint256 amount) external nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount >= minBridgeAmount, "Amount below minimum");
        
        // 1. Calculate fee (up to 1%)
        uint256 fee = (amount * feeRate) / DENOMINATOR;
        uint256 amountAfterFee = amount - fee;
        require(amountAfterFee > 0, "Amount too small after fee");

        // 2. Transfer tokens using SafeERC20 (prevents reentrancy with ERC777)
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // 3. Handle fee
        if (fee > 0) {
            token.safeTransfer(feeWallet, fee);
        }

        // 4. Handle remaining tokens based on mode
        if (isMintMode) {
            // BSC Mode: Burn tokens being bridged out
            bridgeableToken.burn(amountAfterFee);
        }
        // X Layer Mode: Tokens remain locked in contract
        
        // 5. Emit event with timestamp for verification
        nonce++;
        emit BridgeInitiated(msg.sender, to, amountAfterFee, fee, nonce, block.timestamp);
    }

    /**
     * @notice Release tokens with signature verification
     * @param to Recipient address
     * @param amount Amount to release
     * @param srcNonce Nonce from source chain
     * @param srcChainId Source chain ID
     * @param signature Relayer signature for verification
     */
    function release(
        address to, 
        uint256 amount, 
        uint256 srcNonce,
        uint256 srcChainId,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(srcChainId == sourceChainId, "Invalid source chain");
        require(!processedNonces[srcNonce], "Nonce already processed");
        
        // Verify signature from authorized relayer
        bytes32 messageHash = keccak256(abi.encodePacked(
            to,
            amount,
            srcNonce,
            srcChainId,
            block.chainid,
            address(this)
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == relayer, "Invalid signature");
        
        // Mark nonce as processed
        processedNonces[srcNonce] = true;

        if (isMintMode) {
            // Dest Chain: Sync tokens to user
            bridgeableToken.bridgeIn(to, amount);
        } else {
            // Source Chain: Unlock tokens
            require(token.balanceOf(address(this)) >= amount, "Insufficient balance");
            token.safeTransfer(to, amount);
        }
        
        emit BridgeFinalized(to, amount, srcNonce);
    }
    
    // ========== Admin Functions ==========
    
    function setFeeRate(uint256 _newFeeRate) external onlyOwner {
        require(_newFeeRate <= MAX_FEE_RATE, "Fee exceeds max");
        uint256 oldRate = feeRate;
        feeRate = _newFeeRate;
        emit FeeRateUpdated(oldRate, _newFeeRate);
    }
    
    function setMinBridgeAmount(uint256 _newMinAmount) external onlyOwner {
        require(_newMinAmount >= MIN_BRIDGE_FLOOR, "Below floor");
        uint256 oldAmount = minBridgeAmount;
        minBridgeAmount = _newMinAmount;
        emit MinBridgeAmountUpdated(oldAmount, _newMinAmount);
    }
    
    function setFeeWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid wallet");
        feeWallet = _newWallet;
        emit FeeWalletUpdated(_newWallet);
    }
    
    function setRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid relayer");
        address oldRelayer = relayer;
        relayer = _newRelayer;
        emit RelayerUpdated(oldRelayer, _newRelayer);
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    /**
     * @notice Emergency withdraw - ONLY for non-bridge tokens (e.g., accidentally sent tokens)
     * @dev Cannot withdraw the bridge token to protect user funds
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        // Prevent withdrawing bridge token in Lock mode (protects user funds)
        if (!isMintMode) {
            require(_token != address(token), "Cannot withdraw bridge token");
        }
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit EmergencyWithdraw(_token, _amount, msg.sender);
    }
    
    /**
     * @notice Get locked token balance (for transparency)
     */
    function getLockedBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}