// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EagleTokenHome
 * @dev EAGLE Token for HOME CHAIN (X Layer)
 * 
 * Supported Chains & Endpoint IDs:
 * - X Layer (Home): 30196
 * - BSC: 30102
 * - Ethereum: 30101
 * - Solana: 30168 (Non-EVM, requires Rust OFT)
 * - Base: 30184
 * 
 * Features:
 * - Mints 1 billion EAGLE to deployer immediately
 * - Supports LayerZero cross-chain
 * - Router whitelist
 */
contract EagleTokenHome is OFT, ERC20Burnable, ReentrancyGuard, AccessControl {
    
    // ============ Constants ============
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    
    // Access Control Roles
    bytes32 public constant ROUTER_MANAGER_ROLE = keccak256("ROUTER_MANAGER_ROLE");
    bytes32 public constant TAX_MANAGER_ROLE = keccak256("TAX_MANAGER_ROLE");
    
    // ============ State Variables ============
    
    // Router whitelist
    mapping(address => bool) public whitelistedRouters;
    address[] public routerList;
    
    // Tax system
    struct TaxConfig {
        uint256 marketingTax;    // 营销税 (basis points, max 300 = 3%)
        uint256 burnTax;         // 销毁税 (basis points, max 300 = 3%)
        uint256 liquidityTax;    // 流动性税 (basis points, max 300 = 3%)
    }
    
    TaxConfig public buyTaxes;   // 买入税务
    TaxConfig public sellTaxes;  // 卖出税务
    
    address public marketingWallet;   // 营销钱包
    address public liquidityWallet;   // 流动性钱包
    
    // Tax exemptions
    mapping(address => bool) public taxExempt;
    
    // DEX pairs for tax calculation
    mapping(address => bool) public dexPairs;
    
    uint256 public constant MAX_TAX_RATE = 300; // 3% maximum per tax type
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points
    
    // ============ Events ============
    event RouterAdded(address indexed router);
    event RouterRemoved(address indexed router);
    event TaxConfigUpdated(string taxType, uint256 marketing, uint256 burn, uint256 liquidity);
    event MarketingWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event LiquidityWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event TaxExemptionUpdated(address indexed account, bool exempt);
    event DexPairUpdated(address indexed pair, bool isDexPair);
    event TaxCollected(address indexed from, address indexed to, uint256 amount, string taxType);
    
    /**
     * @dev Constructor for X LAYER
     * @param _lzEndpoint LayerZero Endpoint for X Layer
     * @param _delegate Owner address
     */
    constructor(
        address _lzEndpoint,
        address _delegate
    ) OFT("Eagle Token", "EAGLE", _lzEndpoint, _delegate) Ownable(_delegate) {
        // Setup Access Control
        _grantRole(DEFAULT_ADMIN_ROLE, _delegate);
        _grantRole(ROUTER_MANAGER_ROLE, _delegate);
        _grantRole(TAX_MANAGER_ROLE, _delegate);
        
        // Initialize tax wallets
        marketingWallet = address(this); // 营销税收集到合约，可提取
        liquidityWallet = _delegate;     // 流动性税回流到LP (后期设置为LP地址)
        
        // Set deployer as tax exempt
        taxExempt[_delegate] = true;
        
        // Initialize taxes as 0% (can be set later)
        buyTaxes = TaxConfig(0, 0, 0);
        sellTaxes = TaxConfig(0, 0, 0);
        
        // MINT ALL TOKENS HERE
        _mint(_delegate, TOTAL_SUPPLY);
    }
    
    // ============ Router Management ============
    
    /**
     * @dev Add a whitelisted router (DEX)
     * @param router Router address to whitelist
     */
    function addRouter(address router) external onlyRole(ROUTER_MANAGER_ROLE) {
        require(router != address(0), "EagleTokenHome: zero address");
        require(!whitelistedRouters[router], "EagleTokenHome: already whitelisted");
        
        whitelistedRouters[router] = true;
        routerList.push(router);
        
        emit RouterAdded(router);
    }
    
    /**
     * @dev Remove a whitelisted router
     * @param router Router address to remove
     */
    function removeRouter(address router) external onlyRole(ROUTER_MANAGER_ROLE) {
        require(whitelistedRouters[router], "EagleTokenHome: not whitelisted");
        
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
    
    // ============ Tax Management ============
    
    /**
     * @dev Set buy taxes (营销税, 销毁税, 流动性税)
     */
    function setBuyTaxes(
        uint256 _marketingTax,
        uint256 _burnTax,
        uint256 _liquidityTax
    ) external onlyRole(TAX_MANAGER_ROLE) {
        require(_marketingTax <= MAX_TAX_RATE, "EagleTokenHome: marketing tax too high");
        require(_burnTax <= MAX_TAX_RATE, "EagleTokenHome: burn tax too high");
        require(_liquidityTax <= MAX_TAX_RATE, "EagleTokenHome: liquidity tax too high");
        
        buyTaxes.marketingTax = _marketingTax;
        buyTaxes.burnTax = _burnTax;
        buyTaxes.liquidityTax = _liquidityTax;
        
        emit TaxConfigUpdated("BUY", _marketingTax, _burnTax, _liquidityTax);
    }
    
    /**
     * @dev Set sell taxes (营销税, 销毁税, 流动性税)
     */
    function setSellTaxes(
        uint256 _marketingTax,
        uint256 _burnTax,
        uint256 _liquidityTax
    ) external onlyRole(TAX_MANAGER_ROLE) {
        require(_marketingTax <= MAX_TAX_RATE, "EagleTokenHome: marketing tax too high");
        require(_burnTax <= MAX_TAX_RATE, "EagleTokenHome: burn tax too high");
        require(_liquidityTax <= MAX_TAX_RATE, "EagleTokenHome: liquidity tax too high");
        
        sellTaxes.marketingTax = _marketingTax;
        sellTaxes.burnTax = _burnTax;
        sellTaxes.liquidityTax = _liquidityTax;
        
        emit TaxConfigUpdated("SELL", _marketingTax, _burnTax, _liquidityTax);
    }
    
    /**
     * @dev Set marketing wallet
     */
    function setMarketingWallet(address _marketingWallet) external onlyRole(TAX_MANAGER_ROLE) {
        require(_marketingWallet != address(0), "EagleTokenHome: zero address");
        address oldWallet = marketingWallet;
        marketingWallet = _marketingWallet;
        emit MarketingWalletUpdated(oldWallet, _marketingWallet);
    }
    
    /**
     * @dev Set liquidity wallet (LP pool address for liquidity tax)
     */
    function setLiquidityWallet(address _liquidityWallet) external onlyRole(TAX_MANAGER_ROLE) {
        require(_liquidityWallet != address(0), "EagleTokenHome: zero address");
        address oldWallet = liquidityWallet;
        liquidityWallet = _liquidityWallet; // 设置为LP池地址，税收直接回流到流动性
        emit LiquidityWalletUpdated(oldWallet, _liquidityWallet);
    }
    
    /**
     * @dev Set tax exemption for address
     */
    function setTaxExempt(address account, bool exempt) external onlyRole(TAX_MANAGER_ROLE) {
        taxExempt[account] = exempt;
        emit TaxExemptionUpdated(account, exempt);
    }
    
    /**
     * @dev Set DEX pair for tax calculation
     */
    function setDexPair(address pair, bool isDexPair) external onlyRole(TAX_MANAGER_ROLE) {
        dexPairs[pair] = isDexPair;
        emit DexPairUpdated(pair, isDexPair);
    }
    
    /**
     * @dev Calculate tax amount
     */
    function calculateTax(address from, address to, uint256 amount) public view returns (uint256 taxAmount, TaxConfig memory appliedTax) {
        // No tax if either party is exempt
        if (taxExempt[from] || taxExempt[to]) {
            return (0, TaxConfig(0, 0, 0));
        }
        
        // Determine if it's buy or sell
        bool isBuy = dexPairs[from];   // Buying from DEX pair
        bool isSell = dexPairs[to];    // Selling to DEX pair
        
        if (isBuy) {
            appliedTax = buyTaxes;
        } else if (isSell) {
            appliedTax = sellTaxes;
        } else {
            // Regular transfer, no tax
            return (0, TaxConfig(0, 0, 0));
        }
        
        uint256 totalTaxRate = appliedTax.marketingTax + appliedTax.burnTax + appliedTax.liquidityTax;
        taxAmount = (amount * totalTaxRate) / BASIS_POINTS;
        
        return (taxAmount, appliedTax);
    }
    
    /**
     * @dev Withdraw marketing tax from contract
     */
    function withdrawMarketingTax(uint256 amount) external onlyRole(TAX_MANAGER_ROLE) {
        require(amount > 0, "EagleTokenHome: amount must be > 0");
        require(balanceOf(address(this)) >= amount, "EagleTokenHome: insufficient balance");
        
        _transfer(address(this), msg.sender, amount);
        emit TaxCollected(address(this), msg.sender, amount, "MARKETING_WITHDRAW");
    }
    
    /**
     * @dev Withdraw all marketing tax from contract
     */
    function withdrawAllMarketingTax() external onlyRole(TAX_MANAGER_ROLE) {
        uint256 balance = balanceOf(address(this));
        require(balance > 0, "EagleTokenHome: no marketing tax to withdraw");
        
        _transfer(address(this), msg.sender, balance);
        emit TaxCollected(address(this), msg.sender, balance, "MARKETING_WITHDRAW_ALL");
    }
    
    /**
     * @dev Get marketing tax balance in contract
     */
    function getMarketingTaxBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }

    
    // ============ Overrides ============
    
    /**
     * @dev Override _update to handle taxes
     */
    function _update(address from, address to, uint256 value) 
        internal 
        override(ERC20) 
        nonReentrant 
    {
        // Skip tax calculation for minting/burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        
        // Calculate tax
        (uint256 taxAmount, TaxConfig memory appliedTax) = calculateTax(from, to, value);
        
        if (taxAmount > 0) {
            uint256 transferAmount = value - taxAmount;
            
            // Transfer the main amount
            super._update(from, to, transferAmount);
            
            // Handle taxes
            _processTaxes(from, taxAmount, appliedTax);
        } else {
            // No tax, regular transfer
            super._update(from, to, value);
        }
    }
    
    /**
     * @dev Process tax distribution
     */
    function _processTaxes(address from, uint256 totalTaxAmount, TaxConfig memory taxes) private {
        uint256 totalTaxRate = taxes.marketingTax + taxes.burnTax + taxes.liquidityTax;
        
        if (totalTaxRate == 0) return;
        
        // Marketing tax
        if (taxes.marketingTax > 0) {
            uint256 marketingAmount = (totalTaxAmount * taxes.marketingTax) / totalTaxRate;
            super._update(from, marketingWallet, marketingAmount);
            emit TaxCollected(from, marketingWallet, marketingAmount, "MARKETING");
        }
        
        // Liquidity tax
        if (taxes.liquidityTax > 0) {
            uint256 liquidityAmount = (totalTaxAmount * taxes.liquidityTax) / totalTaxRate;
            super._update(from, liquidityWallet, liquidityAmount);
            emit TaxCollected(from, liquidityWallet, liquidityAmount, "LIQUIDITY");
        }
        
        // Burn tax
        if (taxes.burnTax > 0) {
            uint256 burnAmount = (totalTaxAmount * taxes.burnTax) / totalTaxRate;
            super._update(from, address(0), burnAmount); // Burn tokens
            emit TaxCollected(from, address(0), burnAmount, "BURN");
        }
    }
    
    /**
     * @dev Override supportsInterface for AccessControl
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    function decimals() public pure override returns (uint8) { return 18; }
}
