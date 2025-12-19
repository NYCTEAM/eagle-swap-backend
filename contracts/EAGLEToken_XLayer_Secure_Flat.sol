// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ OpenZeppelin Contracts (Flattened) ============

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

// IERC20Metadata
interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

// IERC20Errors
interface IERC20Errors {
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidSpender(address spender);
}

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

// ERC20
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;
    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                _totalSupply -= value;
            }
        } else {
            unchecked {
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}

// ERC20Burnable
abstract contract ERC20Burnable is Context, ERC20 {
    function burn(uint256 value) public virtual {
        _burn(_msgSender(), value);
    }

    function burnFrom(address account, uint256 value) public virtual {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
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

// ============ Uniswap V2 Interfaces ============

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
    ) external;
    
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
    ) external;
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

// ============ EAGLEToken_XLayer_Secure Contract ============

/**
 * @title EAGLEToken_XLayer_Secure
 * @notice Native Token on X Layer
 */
contract EAGLEToken_XLayer_Secure is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant MAX_TAX = 600; // 6% max total tax
    uint256 public constant MAX_SINGLE_TAX = 200; // 2% max per tax type
    
    address public marketingWallet;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    
    // Tax config
    uint256 public marketingTax = 0;
    uint256 public burnTax = 0;
    uint256 public liquidityTax = 0;
    uint256 public totalTax = 0;
    uint256 public maxTaxEverSet = 0;
    
    bool public taxEnabled = false;
    bool public taxLocked = false;
    
    // Trading Switch (One-way)
    bool public tradingEnabled = false;

    mapping(address => bool) public isExcludedFromFee;
    
    // Swap config
    bool public swapTaxEnabled = true;
    uint256 public swapTaxAtAmount = 1000 * 10**18; 
    uint256 public accumulatedTaxTokens = 0;
    uint256 public constant MAX_ACCUMULATED_TAX = 10_000_000 * 10**18;
    uint256 public constant MAX_SLIPPAGE_BPS = 600; // 6% maximum slippage protection
    uint256 public constant SWAP_DEADLINE = 300;
    bool private swapping;
    
    // Known Uniswap V2 Pair bytecode hash (mainnet)
    bytes32 public constant UNISWAP_V2_PAIR_INIT_CODE_HASH = 0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f;
    
    // DEX config
    IUniswapV2Router02 public router;
    address public taxQuoteToken;
    address public immutable mainPair;
    mapping(address => bool) public automatedMarketMakerPairs;
    mapping(address => bool) public isRouter;
    address[] public allRouters;
    
    // Events
    event TaxUpdated(uint256 marketing, uint256 burn, uint256 liquidity);
    event TaxEnabled(bool enabled);
    event TradingEnabled();
    event MarketingWalletUpdated(address newWallet);
    event PairAdded(address indexed pair);
    event RouterAdded(address indexed router);
    event TaxRouterSet(address indexed router);
    event TaxQuoteTokenSet(address indexed token);
    event TaxSwapped(uint256 tokensSwapped, uint256 amountReceived, address currency);
    event TaxSwapFailed(uint256 amount);
    
    constructor(
        address _router,
        address _marketingWallet,
        address _quoteToken
    ) ERC20("EAGLE", "EAGLE") Ownable(msg.sender) {
        require(_marketingWallet != address(0), "Invalid marketing wallet");
        require(_quoteToken != address(0), "Invalid quote token");
        
        marketingWallet = _marketingWallet;
        taxQuoteToken = _quoteToken;
        
        // Initialize mainPair - immutable must be assigned exactly once unconditionally
        address _mainPair = address(0);
        
        if (_router != address(0)) {
            router = IUniswapV2Router02(_router);
            isRouter[_router] = true;
            allRouters.push(_router);
            
            // Try to get existing pair first, then create if not exists
            address factory = router.factory();
            address existingPair = IUniswapV2Factory(factory).getPair(address(this), _quoteToken);
            
            if (existingPair != address(0) && _isValidPair(existingPair, address(this), _quoteToken)) {
                _mainPair = existingPair;
            } else {
                // Create new pair
                try IUniswapV2Factory(factory).createPair(address(this), _quoteToken) returns (address _pair) {
                    if (_isValidPair(_pair, address(this), _quoteToken)) {
                        _mainPair = _pair;
                    }
                } catch {}
            }
            
            if (_mainPair != address(0)) {
                automatedMarketMakerPairs[_mainPair] = true;
                emit PairAdded(_mainPair);
            }
        }
        
        // Single unconditional assignment to immutable
        mainPair = _mainPair;
        
        _mint(msg.sender, MAX_SUPPLY);
        
        isExcludedFromFee[msg.sender] = true;
        isExcludedFromFee[address(this)] = true;
        isExcludedFromFee[_marketingWallet] = true;
        isExcludedFromFee[DEAD] = true;
    }
    
    receive() external payable {}
    
    /**
     * @notice Enable trading. One-way switch.
     */
    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Already enabled");
        tradingEnabled = true;
        emit TradingEnabled();
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // Allow mint (from = 0) and burn (to = 0)
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        
        require(amount > 0, "Zero amount");
        
        if (from == address(this) || to == address(this)) {
            super._update(from, to, amount);
            return;
        }

        // Trading Check
        if (!tradingEnabled) {
            // Allow normal transfers, but restrict DEX trading
            if (automatedMarketMakerPairs[from] || automatedMarketMakerPairs[to]) {
                require(isExcludedFromFee[from] || isExcludedFromFee[to], "Trading disabled");
            }
        }
        
        // Auto SwapBack
        if (
            accumulatedTaxTokens >= swapTaxAtAmount &&
            !swapping &&
            swapTaxEnabled &&
            !automatedMarketMakerPairs[from] // Sell
        ) {
            swapping = true;
            _swapTax(swapTaxAtAmount);
            swapping = false;
        }
        
        bool takeFee = !swapping &&
            !isExcludedFromFee[from] &&
            !isExcludedFromFee[to] &&
            (automatedMarketMakerPairs[from] || automatedMarketMakerPairs[to]) && 
            taxEnabled &&
            totalTax > 0;
            
        if (takeFee) {
            uint256 fees = (amount * totalTax) / 10000;
            if (burnTax > 0) {
                uint256 burnAmount = (amount * burnTax) / 10000;
                _burn(from, burnAmount);
                fees -= burnAmount; 
            }
            if (fees > 0) {
                super._update(from, address(this), fees);
                accumulatedTaxTokens += fees;
                if (accumulatedTaxTokens > MAX_ACCUMULATED_TAX) accumulatedTaxTokens = MAX_ACCUMULATED_TAX;
            }
            amount -= (amount * totalTax) / 10000;
        }
        
        super._update(from, to, amount);
    }
    
    /**
     * @dev Internal swap function with reentrancy protection via swapping flag
     * Uses CEI pattern: Checks-Effects-Interactions
     */
    function _swapTax(uint256 tokenAmount) private {
        // CHECKS
        if (tokenAmount == 0 || address(router) == address(0)) return;
        if (taxQuoteToken == address(0)) return;
        
        // EFFECTS - Update state BEFORE external calls (CEI pattern)
        uint256 amountToSwap = tokenAmount;
        if (accumulatedTaxTokens >= amountToSwap) {
            accumulatedTaxTokens -= amountToSwap;
        } else {
            amountToSwap = accumulatedTaxTokens;
            accumulatedTaxTokens = 0;
        }
        
        if (amountToSwap == 0) return;
        
        // Calculate minimum output with slippage protection
        uint256 amountOutMin = _getAmountOutMin(amountToSwap);
        
        _approve(address(this), address(router), amountToSwap);
        
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = taxQuoteToken;
        
        // Dynamic deadline
        uint256 deadline = block.timestamp + SWAP_DEADLINE;
        
        // INTERACTIONS - External call last
        try router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountToSwap, amountOutMin, path, marketingWallet, deadline
        ) {
            emit TaxSwapped(amountToSwap, amountOutMin, taxQuoteToken);
        } catch {
            // Restore state on failure
            accumulatedTaxTokens += amountToSwap;
            emit TaxSwapFailed(amountToSwap);
        }
    }
    
    /**
     * @dev Calculate minimum output amount with slippage protection
     */
    function _getAmountOutMin(uint256 amountIn) private view returns (uint256) {
        if (address(router) == address(0)) return 0;
        
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = taxQuoteToken;
        
        try router.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            // Apply slippage tolerance (6% = 600 bps max)
            return (amounts[1] * (10000 - MAX_SLIPPAGE_BPS)) / 10000;
        } catch {
            return 0; // If quote fails, allow swap with 0 min (fallback)
        }
    }
    
    /**
     * @dev Validate that a pair address is a legitimate Uniswap V2 pair
     */
    function _isValidPair(address pair, address tokenA, address tokenB) private view returns (bool) {
        if (pair == address(0)) return false;
        if (pair.code.length == 0) return false;
        
        // Verify pair contains correct tokens
        try IUniswapV2Pair(pair).token0() returns (address t0) {
            try IUniswapV2Pair(pair).token1() returns (address t1) {
                bool validTokens = (t0 == tokenA && t1 == tokenB) || (t0 == tokenB && t1 == tokenA);
                if (!validTokens) return false;
                
                // Additional check: pair should have getReserves function
                try IUniswapV2Pair(pair).getReserves() returns (uint112, uint112, uint32) {
                    return true;
                } catch {
                    return false;
                }
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    // Admin Functions
    function updateMarketingWallet(address _wallet) external onlyOwner {
        marketingWallet = _wallet;
        isExcludedFromFee[_wallet] = true;
        emit MarketingWalletUpdated(_wallet);
    }
    
    function updateTaxRates(uint256 _marketing, uint256 _burn, uint256 _liquidity) external onlyOwner {
        uint256 newTotal = _marketing + _burn + _liquidity;
        require(newTotal <= MAX_TAX, "Tax too high");
        if (taxLocked) require(newTotal <= totalTax, "Locked");
        
        marketingTax = _marketing;
        burnTax = _burn;
        liquidityTax = _liquidity;
        totalTax = newTotal;
        if (newTotal > maxTaxEverSet) maxTaxEverSet = newTotal;
        emit TaxUpdated(_marketing, _burn, _liquidity);
    }
    
    function setTaxQuoteToken(address _token) external onlyOwner {
        taxQuoteToken = _token;
        emit TaxQuoteTokenSet(_token);
    }
    
    function addRouter(address _router) external onlyOwner {
        if (!isRouter[_router]) {
            isRouter[_router] = true;
            allRouters.push(_router);
            emit RouterAdded(_router);
        }
    }
    
    function setTaxRouter(address _router) external onlyOwner {
        require(isRouter[_router], "Router not added");
        router = IUniswapV2Router02(_router);
        emit TaxRouterSet(_router);
    }
    
    function addPair(address pair) external onlyOwner {
        require(pair != address(0), "Invalid pair");
        require(_isValidPair(pair, address(this), taxQuoteToken) || 
                _isValidPair(pair, address(this), router.WETH()), "Not a valid pair");
        automatedMarketMakerPairs[pair] = true;
        emit PairAdded(pair);
    }
    
    function removePair(address pair) external onlyOwner {
        require(pair != mainPair, "Cannot remove main pair");
        automatedMarketMakerPairs[pair] = false;
    }
    
    function setTaxEnabled(bool _enabled) external onlyOwner {
        taxEnabled = _enabled;
        emit TaxEnabled(_enabled);
    }
    
    function lockTax() external onlyOwner {
        taxLocked = true;
    }

    function setSwapThreshold(uint256 _amount) external onlyOwner {
        swapTaxAtAmount = _amount;
    }
    
    function excludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
    }
    
    function getCirculatingSupply() external view returns (uint256) {
        return totalSupply() - balanceOf(DEAD) - balanceOf(address(0));
    }
}
