// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EagleToken
 * @dev EAGLE Token - Fixed supply ERC20 with multi-router support
 * 
 * Features:
 * - Fixed supply: 1 billion EAGLE (all minted to deployer)
 * - Multiple router whitelist (OKX DEX, future EagleSwap)
 * - Burnable by token holders
 * - Pausable for emergencies
 * - Owner transfers EAGLE to mining contract manually
 */
contract EagleToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    
    // ============ State Variables ============
    
    /// @notice Total supply (1 billion EAGLE)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    
    /// @notice Whitelisted DEX routers (for future tax/fee exemption if needed)
    mapping(address => bool) public whitelistedRouters;
    
    /// @notice List of all router addresses (for enumeration)
    address[] public routerList;
    
    // ============ Events ============
    
    event RouterAdded(address indexed router);
    event RouterRemoved(address indexed router);
    
    // ============ Constructor ============
    
    /**
     * @dev Constructor - mints entire supply (1 billion EAGLE) to deployer
     */
    constructor() ERC20("Eagle Token", "EAGLE") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    // ============ Router Management ============
    
    /**
     * @dev Add a whitelisted router (DEX)
     * @param router Router address to whitelist
     */
    function addRouter(address router) external onlyOwner {
        require(router != address(0), "EagleToken: zero address");
        require(!whitelistedRouters[router], "EagleToken: already whitelisted");
        
        whitelistedRouters[router] = true;
        routerList.push(router);
        
        emit RouterAdded(router);
    }
    
    /**
     * @dev Remove a whitelisted router
     * @param router Router address to remove
     */
    function removeRouter(address router) external onlyOwner {
        require(whitelistedRouters[router], "EagleToken: not whitelisted");
        
        whitelistedRouters[router] = false;
        
        // Remove from list
        for (uint256 i = 0; i < routerList.length; i++) {
            if (routerList[i] == router) {
                routerList[i] = routerList[routerList.length - 1];
                routerList.pop();
                break;
            }
        }
        
        emit RouterRemoved(router);
    }
    
    /**
     * @dev Get all whitelisted routers
     */
    function getRouters() external view returns (address[] memory) {
        return routerList;
    }
    
    /**
     * @dev Check if address is a whitelisted router
     */
    function isRouter(address account) external view returns (bool) {
        return whitelistedRouters[account];
    }
    
    // ============ Pausable Functions ============
    
    /**
     * @dev Pause all token transfers (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Overrides ============
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
