// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ OpenZeppelin Contracts (Flattened) ============

// Context
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// Ownable
abstract contract Ownable is Context {
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// ReentrancyGuard
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// IERC20
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// IERC20Permit
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// Address
library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert AddressInsufficientBalance(address(this));
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert FailedInnerCall();
        }
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}

// SafeERC20
library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool))) && address(token).code.length > 0;
    }
}

// ECDSA
library ECDSA {
    enum RecoverError {
        NoError,
        InvalidSignature,
        InvalidSignatureLength,
        InvalidSignatureS
    }

    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);

    function tryRecover(bytes32 hash, bytes memory signature) internal pure returns (address, RecoverError, bytes32) {
        if (signature.length == 65) {
            bytes32 r;
            bytes32 s;
            uint8 v;
            assembly {
                r := mload(add(signature, 0x20))
                s := mload(add(signature, 0x40))
                v := byte(0, mload(add(signature, 0x60)))
            }
            return tryRecover(hash, v, r, s);
        } else {
            return (address(0), RecoverError.InvalidSignatureLength, bytes32(signature.length));
        }
    }

    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        (address recovered, RecoverError error, bytes32 errorArg) = tryRecover(hash, signature);
        _throwError(error, errorArg);
        return recovered;
    }

    function tryRecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address, RecoverError, bytes32) {
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return (address(0), RecoverError.InvalidSignatureS, s);
        }

        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) {
            return (address(0), RecoverError.InvalidSignature, bytes32(0));
        }

        return (signer, RecoverError.NoError, bytes32(0));
    }

    function recover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        (address recovered, RecoverError error, bytes32 errorArg) = tryRecover(hash, v, r, s);
        _throwError(error, errorArg);
        return recovered;
    }

    function _throwError(RecoverError error, bytes32 errorArg) private pure {
        if (error == RecoverError.NoError) {
            return;
        } else if (error == RecoverError.InvalidSignature) {
            revert ECDSAInvalidSignature();
        } else if (error == RecoverError.InvalidSignatureLength) {
            revert ECDSAInvalidSignatureLength(uint256(errorArg));
        } else if (error == RecoverError.InvalidSignatureS) {
            revert ECDSAInvalidSignatureS(errorArg);
        }
    }
}

// Strings (minimal for MessageHashUtils)
library Strings {
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

// MessageHashUtils
library MessageHashUtils {
    function toEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32 digest) {
        assembly {
            mstore(0x00, "\x19Ethereum Signed Message:\n32")
            mstore(0x1c, messageHash)
            digest := keccak256(0x00, 0x3c)
        }
    }

    function toEthSignedMessageHash(bytes memory message) internal pure returns (bytes32) {
        return
            keccak256(bytes.concat("\x19Ethereum Signed Message:\n", bytes(Strings.toString(message.length)), message));
    }

    function toDataWithIntendedValidatorHash(address validator, bytes memory data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"19_00", validator, data));
    }

    function toTypedDataHash(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32 digest) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
    }
}

// ============ Bridge Token Interface ============

interface IBridgeableERC20 is IERC20 {
    function bridgeIn(address to, uint256 amount) external;
    function bridgeOut(uint256 amount) external;
    function burn(uint256 amount) external;
}

// ============ EagleBridge Contract ============

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
