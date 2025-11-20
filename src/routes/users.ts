import { Router } from 'express';
import { userService } from '../services/userService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validatePagination,
  validateChainId,
  validateAddress,
  validateUser
} from '../middleware/validation';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// ============================================
// 自动注册或获取用户
// ============================================
router.post('/register', asyncHandler(async (req, res) => {
  const { wallet_address, referral_code, username, avatar_url } = req.body;
  
  if (!wallet_address) {
    return res.status(400).json({
      success: false,
      error: 'Wallet address is required'
    });
  }
  
  const result = await userService.registerOrGetUser(wallet_address, referral_code, username, avatar_url);
  
  return res.json({
    success: true,
    message: result.isNewUser ? 'User registered successfully' : 'User already exists',
    data: result.user,
    isNewUser: result.isNewUser
  });
}));

// ============================================
// 上传头像
// ============================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req: any, file: any, cb: any) {
    const address = req.body.address;
    const ext = path.extname(file.originalname);
    cb(null, `${address}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req: any, file: any, cb: any) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

router.post('/upload-avatar', upload.single('avatar'), asyncHandler(async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  
  return res.json({
    success: true,
    data: {
      avatar_url: avatarUrl
    }
  });
}));

// ============================================
// 检查用户名是否可用
// ============================================
router.get('/check-username/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  
  try {
    const db = require('../database/init').getDatabase();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', [username], (err: any, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        res.json({
          success: true,
          available: !row,
          message: row ? 'Username already taken' : 'Username available'
        });
        resolve(null);
      });
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to check username'
    });
  }
}));

// ============================================
// 更新用户资料
// ============================================
router.put('/:address/profile', asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { username, avatar_url, referral_code } = req.body;
  
  try {
    const db = require('../database/init').getDatabase();
    
    return new Promise((resolve, reject) => {
      // Check if user exists
      db.get('SELECT * FROM users WHERE wallet_address = ?', [address.toLowerCase()], (err: any, user: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!user) {
          res.status(404).json({
            success: false,
            error: 'User not found'
          });
          resolve(null);
          return;
        }
        
        // Build update query
        const updates: string[] = [];
        const values: any[] = [];
        
        if (username !== undefined) {
          updates.push('username = ?');
          values.push(username);
        }
        
        if (avatar_url !== undefined) {
          updates.push('avatar_url = ?');
          values.push(avatar_url);
        }
        
        // Handle referral code activation
        if (referral_code && !user.referrer_id) {
          // Find referrer by code
          db.get('SELECT id, wallet_address, referrer_id FROM users WHERE referral_code = ?', [referral_code], (err: any, referrer: any) => {
            if (!err && referrer) {
              // Check if referrer is trying to use referee's code (prevent circular referrals)
              db.get('SELECT id FROM users WHERE id = ? AND referrer_id = ?', [referrer.id, user.id], (err: any, circular: any) => {
                if (circular) {
                  res.status(400).json({
                    success: false,
                    error: 'Cannot use referral code: Circular referral detected. This user is already your referee.'
                  });
                  resolve(null);
                  return;
                }
                
                updates.push('referrer_id = ?');
                values.push(referrer.id);
                
                // Create referral relationship
                db.run(`
                  INSERT INTO referral_relationships (
                    referrer_address,
                    referee_address,
                    referral_code,
                    is_confirmed
                  ) VALUES (?, ?, ?, 0)
                `, [referrer.wallet_address, address.toLowerCase(), referral_code], (err: any) => {
                  if (err) {
                    console.error('Failed to create referral relationship:', err);
                  }
                });
                
                // Continue with update
                performUpdate();
              });
            } else {
              performUpdate();
            }
          });
        } else {
          performUpdate();
        }
        
        function performUpdate() {
          if (updates.length === 0) {
            res.json({
              success: true,
              message: 'No changes to update'
            });
            resolve(null);
            return;
          }
          
          values.push(address.toLowerCase());
          const query = `UPDATE users SET ${updates.join(', ')} WHERE wallet_address = ?`;
          
          db.run(query, values, function(err: any) {
            if (err) {
              reject(err);
              return;
            }
            
            // Get updated user
            db.get('SELECT * FROM users WHERE wallet_address = ?', [address.toLowerCase()], (err: any, updatedUser: any) => {
              if (err) {
                reject(err);
                return;
              }
              
              res.json({
                success: true,
                message: 'Profile updated successfully',
                data: updatedUser
              });
              resolve(null);
            });
          });
        }
      });
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
}));

// ============================================
// 获取用户信息（通过地址）
// ============================================
router.get('/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  try {
    const user = await userService.getUserByAddress(address);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
}));

// ============================================
// 检查用户是否存在
// ============================================
router.get('/exists/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  try {
    const user = await userService.getUserByAddress(address);
    
    if (user) {
      return res.json({
        success: true,
        data: user
      });
    } else {
      return res.json({
        success: false,
        data: null
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to check user'
    });
  }
}));

// Get all users with pagination
router.get('/', 
  validatePagination,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20 } = req.query;
    
    const result = await userService.getUsers(
      parseInt(page as string),
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  })
);

// Search users
router.get('/search',
  validatePagination,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { q, page = 1, limit = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const result = await userService.searchUsers(
      q,
      parseInt(page as string),
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  })
);

// Get user by address
router.get('/:address',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;
    const user = await userService.getUserByAddress(address);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: user
    });
  })
);

// Create or update user
router.post('/',
  validateUser,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address, username, email, avatar_url } = req.body;

    try {
      const user = await userService.createOrUpdateUser({
        address,
        username,
        email,
        avatar_url
      });

      logger.info('User created/updated', { address, username });

      return res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      logger.error('Failed to create/update user', {
        address,
        username,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create/update user'
      });
    }
  })
);

// Update user
router.put('/:address',
  validateAddress,
  validateUser,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;
    const { username, email, avatar_url } = req.body;

    try {
      const user = await userService.createOrUpdateUser({
        address,
        username,
        email,
        avatar_url
      });

      logger.info('User updated', { address, username });

      return res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      logger.error('Failed to update user', {
        address,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update user'
      });
    }
  })
);

// Delete user (soft delete)
router.delete('/:address',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;

    try {
      await userService.deleteUser(address);

      logger.info('User deleted', { address });

      return res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      logger.error('Failed to delete user', {
        address,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete user'
      });
    }
  })
);

// Get user portfolio
router.get('/:address/portfolio',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;
    const { chainIds } = req.query;

    try {
      let chainIdArray: number[] | undefined;
      
      if (chainIds && typeof chainIds === 'string') {
        chainIdArray = chainIds.split(',').map(id => parseInt(id.trim()));
      }

      const portfolio = await userService.getUserPortfolio(address, chainIdArray);

      return res.json({
        success: true,
        data: portfolio
      });
    } catch (error: any) {
      logger.error('Failed to get user portfolio', {
        address,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get user portfolio'
      });
    }
  })
);

// Get user transaction history
router.get('/:address/transactions',
  validateAddress,
  validatePagination,
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;
    const { page = 1, limit = 20, chainId, type } = req.query;

    const result = await userService.getUserTransactionHistory(
      address,
      parseInt(page as string),
      parseInt(limit as string),
      chainId ? parseInt(chainId as string) : undefined,
      type as string
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  })
);

// Get user statistics
router.get('/:address/stats',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;

    try {
      const stats = await userService.getUserStats(address);

      return res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Failed to get user stats', {
        address,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get user stats'
      });
    }
  })
);

// Update user preferences
router.put('/:address/preferences',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Preferences object is required'
      });
    }

    try {
      const user = await userService.updateUserPreferences(address, preferences);

      logger.info('User preferences updated', { address });

      return res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      logger.error('Failed to update user preferences', {
        address,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update user preferences'
      });
    }
  })
);

// Get user activity summary
router.get('/:address/activity',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { address } = req.params;
    const { days = 30 } = req.query;

    try {
      const activity = await userService.getUserActivitySummary(
        address,
        parseInt(days as string)
      );

      return res.json({
        success: true,
        data: activity
      });
    } catch (error: any) {
      logger.error('Failed to get user activity', {
        address,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get user activity'
      });
    }
  })
);

export default router;