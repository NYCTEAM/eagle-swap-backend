import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ApiError } from '../types';

// Validation result checker
export const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: any) => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    throw new ApiError(
      `Validation failed: ${formattedErrors.map(e => e.message).join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  next();
};

// Common validation rules
export const validateAddress = (field: string) => 
  body(field)
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage(`${field} must be a valid Ethereum address`);

export const validateTokenAddress = validateAddress('tokenAddress');
export const validateUserAddress = validateAddress('userAddress');

export const validateAmount = (field: string) =>
  body(field)
    .isString()
    .matches(/^\d+(\.\d+)?$/)
    .withMessage(`${field} must be a valid amount`);

export const validateChainId = (field: string = 'chainId') =>
  body(field)
    .isInt({ min: 1 })
    .withMessage(`${field} must be a valid chain ID`);

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Token validation
export const validateToken = [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  body('symbol').isString().isLength({ min: 1, max: 10 }).withMessage('Symbol must be 1-10 characters'),
  body('name').isString().isLength({ min: 1, max: 50 }).withMessage('Name must be 1-50 characters'),
  body('decimals').isInt({ min: 0, max: 18 }).withMessage('Decimals must be between 0 and 18'),
  body('chainId').isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  checkValidation
];

// Swap validation
export const validateSwap = [
  body('tokenIn').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenIn address'),
  body('tokenOut').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenOut address'),
  body('amountIn').isString().matches(/^\d+$/).withMessage('Invalid amountIn'),
  body('amountOutMin').isString().matches(/^\d+$/).withMessage('Invalid amountOutMin'),
  body('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  body('slippage').optional().isFloat({ min: 0, max: 50 }).withMessage('Slippage must be between 0 and 50'),
  body('deadline').optional().isInt({ min: 0 }).withMessage('Deadline must be positive'),
  checkValidation
];

// Liquidity validation
export const validateAddLiquidity = [
  body('tokenA').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenA address'),
  body('tokenB').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenB address'),
  body('amountA').isString().matches(/^\d+$/).withMessage('Invalid amountA'),
  body('amountB').isString().matches(/^\d+$/).withMessage('Invalid amountB'),
  body('amountAMin').isString().matches(/^\d+$/).withMessage('Invalid amountAMin'),
  body('amountBMin').isString().matches(/^\d+$/).withMessage('Invalid amountBMin'),
  body('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  body('deadline').optional().isInt({ min: 0 }).withMessage('Deadline must be positive'),
  checkValidation
];

export const validateRemoveLiquidity = [
  body('tokenA').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenA address'),
  body('tokenB').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenB address'),
  body('liquidity').isString().matches(/^\d+$/).withMessage('Invalid liquidity amount'),
  body('amountAMin').isString().matches(/^\d+$/).withMessage('Invalid amountAMin'),
  body('amountBMin').isString().matches(/^\d+$/).withMessage('Invalid amountBMin'),
  body('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  body('deadline').optional().isInt({ min: 0 }).withMessage('Deadline must be positive'),
  checkValidation
];

// Farm validation
export const validateStake = [
  body('farmId').isInt({ min: 1 }).withMessage('Invalid farm ID'),
  body('amount').isString().matches(/^\d+$/).withMessage('Invalid stake amount'),
  body('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  checkValidation
];

export const validateUnstake = [
  body('farmId').isInt({ min: 1 }).withMessage('Invalid farm ID'),
  body('amount').isString().matches(/^\d+$/).withMessage('Invalid unstake amount'),
  body('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  checkValidation
];

// User validation
export const validateUser = [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  body('username').optional().isString().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  checkValidation
];

// Price validation
export const validatePriceQuery = [
  query('tokens').isString().withMessage('Tokens parameter is required'),
  query('vs_currency').optional().isString().withMessage('Invalid vs_currency'),
  checkValidation
];

// Parameter validation
export const validateTokenParam = [
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  checkValidation
];

export const validateUserParam = [
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  checkValidation
];

export const validateFarmParam = [
  param('id').isInt({ min: 1 }).withMessage('Invalid farm ID'),
  checkValidation
];

export const validateTransactionParam = [
  param('hash').isString().matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash'),
  checkValidation
];