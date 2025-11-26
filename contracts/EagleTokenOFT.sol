// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title EagleTokenOFT
 * @dev EAGLE Token - Omnichain Fungible Token (LayerZero V2)
 * 
 * Features:
 * - Fixed total supply: 1 billion EAGLE (shared across ALL chains)
 * - Cross-chain transfers via LayerZero
 * - Burnable by token holders
 * - Pausable for emergencies
 * - Multi-router whitelist support
 * 
 * Supported Chains:
 * - X Layer (Home Chain) - EID: 30196
 * - Ethereum Mainnet    - EID: 30101
 * - BSC (BNB Chain)     - EID: 30102
 * - Base                - EID: 30184
 * - Arbitrum One        - EID: 30110
 * - Polygon             - EID: 30109
 * - Avalanche           - EID: 30106
 * - Optimism            - EID: 30111
 * 
 * Deployment:
 * - Deploy on X Layer (home chain) with full supply (isHomeChain = true)
 * - Deploy on other chains with 0 supply (isHomeChain = false)
 * - Call setPeer() on each contract to connect chains
 */
contract EagleTokenOFT is OFT, ERC20Burnable, ERC20Pausable {
    
    // ============ State Variables ============
    
    /// @notice Total supply (1 billion EAGLE) - only minted on home chain
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    
    /// @notice Whether this is the home chain (where tokens are initially minted)
    bool public immutable isHomeChain;
    
    /// @notice Whitelisted DEX routers
    mapping(address => bool) public whitelistedRouters;
    address[] public routerList;
    
    // ============ Events ============
    
    event RouterAdded(address indexed router);
    event RouterRemoved(address indexed router);
    
    // ============ Constructor ============
    
    /**
     * @dev Constructor
     * @param _lzEndpoint LayerZero endpoint address for this chain
     * @param _delegate Owner/delegate address
     * @param _isHomeChain True if this is the home chain (X Layer), false for other chains
     */
    constructor(
        address _lzEndpoint,
        address _delegate,
        bool _isHomeChain
    ) OFT("Eagle Token", "EAGLE", _lzEndpoint, _delegate) Ownable(_delegate) {
        isHomeChain = _isHomeChain;
        
        // Only mint on home chain
        if (_isHomeChain) {
            _mint(_delegate, TOTAL_SUPPLY);
        }
    }
    
    // ============ Cross-Chain Functions ============
    
    /**
     * @dev Send tokens to another chain
     * @param _dstEid Destination chain endpoint ID
     * @param _to Recipient address (bytes32 format)
     * @param _amount Amount to send
     * @param _options LayerZero options
     * 
     * Example usage:
     * send(30102, bytes32(recipientAddress), 1000e18, options)
     */
    // Inherited from OFT: send(), quote()
    
    // ============ Router Management ============
    
    function addRouter(address router) external onlyOwner {
        require(router != address(0), "EagleToken: zero address");
        require(!whitelistedRouters[router], "EagleToken: already whitelisted");
        
        whitelistedRouters[router] = true;
        routerList.push(router);
        
        emit RouterAdded(router);
    }
    
    function removeRouter(address router) external onlyOwner {
        require(whitelistedRouters[router], "EagleToken: not whitelisted");
        
        whitelistedRouters[router] = false;
        
        for (uint256 i = 0; i < routerList.length; i++) {
            if (routerList[i] == router) {
                routerList[i] = routerList[routerList.length - 1];
                routerList.pop();
                break;
            }
        }
        
        emit RouterRemoved(router);
    }
    
    function getRouters() external view returns (address[] memory) {
        return routerList;
    }
    
    function isRouter(address account) external view returns (bool) {
        return whitelistedRouters[account];
    }
    
    // ============ Pausable Functions ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Overrides ============
    
    /**
     * @dev Override for multiple inheritance (ERC20, ERC20Pausable)
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
    
    /**
     * @dev Override decimals (OFT uses shared decimals for cross-chain)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
