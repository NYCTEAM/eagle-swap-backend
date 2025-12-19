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

// ============ DEX Interfaces ============

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
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

// ============ EAGLE Token X Layer (Source Chain) ============

/**
 * @title EAGLEToken_XLayer
 * @notice Source Token on X Layer with Tax, Protection & Bridge Lock/Unlock
 * @dev X Layer is the source chain - tokens are locked/unlocked (not minted/burned)
 */
contract EAGLEToken_XLayer is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    
    uint256 public constant MAX_TAX = 600; // 6% max total tax
    uint256 public constant MAX_SINGLE_TAX = 200; // 2% max per tax type
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 Billion
    
    address public marketingWallet;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    
    // Bridge Address (for lock/unlock)
    address public bridge;

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
    event BridgeSet(address indexed bridge);
    event TaxSentToMarketing(uint256 amount);
    event TaxLocked();
    
    constructor(
        address _router,
        address _marketingWallet,
        address _quoteToken,
        uint256 _initialSupply
    ) ERC20("EAGLE", "EAGLE") Ownable(msg.sender) {
        require(_marketingWallet != address(0), "Invalid marketing wallet");
        require(_quoteToken != address(0), "Invalid quote token");
        require(_initialSupply <= MAX_SUPPLY, "Exceeds max supply");
        
        marketingWallet = _marketingWallet;
        taxQuoteToken = _quoteToken;
        
        // Initialize mainPair
        address _mainPair = address(0);
        
        if (_router != address(0)) {
            router = IUniswapV2Router02(_router);
            isRouter[_router] = true;
            allRouters.push(_router);
            
            address factory = router.factory();
            address existingPair = IUniswapV2Factory(factory).getPair(address(this), _quoteToken);
            
            if (existingPair != address(0) && _isValidPair(existingPair, address(this), _quoteToken)) {
                _mainPair = existingPair;
            } else {
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
        
        mainPair = _mainPair;
        
        // Mint initial supply to deployer (X Layer is source chain)
        if (_initialSupply > 0) {
            _mint(msg.sender, _initialSupply);
        }
        
        isExcludedFromFee[msg.sender] = true;
        isExcludedFromFee[address(this)] = true;
        isExcludedFromFee[_marketingWallet] = true;
        isExcludedFromFee[DEAD] = true;
    }
    
    receive() external payable {}

    // ========== Bridge Functions (Lock/Unlock for Source Chain) ==========

    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid bridge");
        bridge = _bridge;
        isExcludedFromFee[_bridge] = true; 
        emit BridgeSet(_bridge);
    }

    /**
     * @dev Bridge unlocks tokens when receiving from destination chain
     * X Layer is source chain - uses Lock/Unlock model
     */
    function bridgeIn(address to, uint256 amount) external {
        require(msg.sender == bridge, "Unauthorized");
        // Transfer from bridge contract to user (unlock)
        _transfer(address(this), to, amount);
    }
    
    /**
     * @dev User locks tokens to bridge to destination chain
     */
    function bridgeOut(uint256 amount) external {
        // Transfer to this contract (lock)
        _transfer(msg.sender, address(this), amount);
    }
    
    /**
     * @notice Enable trading. One-way switch.
     */
    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Already enabled");
        tradingEnabled = true;
        emit TradingEnabled();
    }
    
    // ========== Core Transfer Logic ==========
    
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
            if (automatedMarketMakerPairs[from] || automatedMarketMakerPairs[to]) {
                require(isExcludedFromFee[from] || isExcludedFromFee[to], "Trading disabled");
            }
        }
        
        // Auto SwapBack Trigger (on Sell)
        if (
            accumulatedTaxTokens >= swapTaxAtAmount &&
            !swapping &&
            swapTaxEnabled &&
            !automatedMarketMakerPairs[from] && 
            automatedMarketMakerPairs[to]       
        ) {
            swapping = true;
            _swapTax(swapTaxAtAmount);
            swapping = false;
        }
        
        // Calculate Tax
        bool takeFee = !swapping &&
            !isExcludedFromFee[from] &&
            !isExcludedFromFee[to] &&
            (automatedMarketMakerPairs[from] || automatedMarketMakerPairs[to]) && 
            taxEnabled &&
            totalTax > 0;
            
        if (takeFee) {
            uint256 fees = (amount * totalTax) / 10000;
            uint256 amountToBurn = 0;
            
            if (burnTax > 0) {
                amountToBurn = (amount * burnTax) / 10000;
                _burn(from, amountToBurn);
                fees -= amountToBurn; 
            }
            
            if (fees > 0) {
                super._update(from, address(this), fees);
                uint256 newAccumulated = accumulatedTaxTokens + fees;
                if (newAccumulated <= MAX_ACCUMULATED_TAX) {
                    accumulatedTaxTokens = newAccumulated;
                }
            }
            
            amount -= (amount * totalTax) / 10000;
        }
        
        super._update(from, to, amount);
    }
    
    // ========== SwapBack Implementation ==========
    
    function _swapTax(uint256 tokenAmount) private {
        if (tokenAmount == 0 || address(router) == address(0)) return;
        if (taxQuoteToken == address(0)) return;
        
        uint256 amountToSwap = tokenAmount;
        if (accumulatedTaxTokens >= amountToSwap) {
            accumulatedTaxTokens -= amountToSwap;
        } else {
            amountToSwap = accumulatedTaxTokens;
            accumulatedTaxTokens = 0;
        }
        
        if (amountToSwap == 0) return;
        
        uint256 amountOutMin = _getAmountOutMin(amountToSwap);
        
        _approve(address(this), address(router), amountToSwap);
        
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = taxQuoteToken;
        
        uint256 deadline = block.timestamp + SWAP_DEADLINE;
        bool isNative = taxQuoteToken == router.WETH();
        
        if (isNative) {
            uint256 initialBalance = address(this).balance;
            try router.swapExactTokensForETHSupportingFeeOnTransferTokens(
                amountToSwap, amountOutMin, path, address(this), deadline
            ) {
                uint256 received = address(this).balance - initialBalance;
                emit TaxSwapped(amountToSwap, received, address(0));
                if (received > 0) {
                    (bool success, ) = payable(marketingWallet).call{value: received}("");
                    if (success) emit TaxSentToMarketing(received);
                }
            } catch {
                accumulatedTaxTokens += amountToSwap;
                emit TaxSwapFailed(amountToSwap);
            }
        } else {
            uint256 initialBalance = IERC20(taxQuoteToken).balanceOf(address(this));
            try router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountToSwap, amountOutMin, path, address(this), deadline
            ) {
                uint256 received = IERC20(taxQuoteToken).balanceOf(address(this)) - initialBalance;
                emit TaxSwapped(amountToSwap, received, taxQuoteToken);
                if (received > 0) {
                    IERC20(taxQuoteToken).transfer(marketingWallet, received);
                }
            } catch {
                accumulatedTaxTokens += amountToSwap;
                emit TaxSwapFailed(amountToSwap);
            }
        }
    }
    
    function _getAmountOutMin(uint256 amountIn) private view returns (uint256) {
        if (address(router) == address(0)) return 0;
        
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = taxQuoteToken;
        
        try router.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return (amounts[1] * (10000 - MAX_SLIPPAGE_BPS)) / 10000;
        } catch {
            return 0;
        }
    }
    
    function _isValidPair(address pair, address tokenA, address tokenB) private view returns (bool) {
        if (pair == address(0)) return false;
        if (pair.code.length == 0) return false;
        
        try IUniswapV2Pair(pair).token0() returns (address t0) {
            try IUniswapV2Pair(pair).token1() returns (address t1) {
                bool validTokens = (t0 == tokenA && t1 == tokenB) || (t0 == tokenB && t1 == tokenA);
                if (!validTokens) return false;
                
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

    // ========== Admin Functions ==========
    
    function updateMarketingWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid address");
        marketingWallet = _wallet;
        isExcludedFromFee[_wallet] = true;
        emit MarketingWalletUpdated(_wallet);
    }
    
    function updateTaxRates(uint256 _marketing, uint256 _burn, uint256 _liquidity) external onlyOwner {
        require(_marketing <= MAX_SINGLE_TAX, "Marketing tax too high");
        require(_burn <= MAX_SINGLE_TAX, "Burn tax too high");
        require(_liquidity <= MAX_SINGLE_TAX, "Liquidity tax too high");
        
        uint256 newTotal = _marketing + _burn + _liquidity;
        require(newTotal <= MAX_TAX, "Total tax exceeds limit");
        
        if (taxLocked) {
            require(newTotal <= totalTax, "Cannot increase tax after lock");
        }
        
        marketingTax = _marketing;
        burnTax = _burn;
        liquidityTax = _liquidity;
        totalTax = newTotal;
        
        emit TaxUpdated(_marketing, _burn, _liquidity);
    }
    
    function setTaxQuoteToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token");
        taxQuoteToken = _token;
        emit TaxQuoteTokenSet(_token);
    }
    
    function addRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router");
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
        emit TaxLocked();
    }

    function setSwapThreshold(uint256 _amount) external onlyOwner {
        swapTaxAtAmount = _amount;
    }
    
    function excludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
    }
    
    function rescueToken(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(this), "Cannot rescue EAGLE");
        IERC20(_token).transfer(msg.sender, _amount);
    }
    
    function rescueETH() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    /**
     * @notice Get locked balance in bridge (for transparency)
     */
    function getLockedBalance() external view returns (uint256) {
        return balanceOf(address(this)) - accumulatedTaxTokens;
    }
}
