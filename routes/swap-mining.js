const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../eagle_swap.db');

// 获取用户 Swap 挖矿状态
router.get('/status/:address', async (req, res) => {
  const { address } = req.params;
  const db = new sqlite3.Database(dbPath);

  try {
    // 1. 获取用户累计交易量和 VIP 等级
    db.get(
      `SELECT 
        COALESCE(SUM(trade_value_usdt), 0) as cumulative_volume,
        COUNT(*) as total_trades
      FROM swap_transactions 
      WHERE user_address = ?`,
      [address],
      (err, volumeData) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error', details: err.message });
        }

        const cumulativeVolume = volumeData?.cumulative_volume || 0;

        // 2. 根据交易量确定 VIP 等级
        db.get(
          `SELECT vip_level, vip_name, boost_percentage, description
          FROM vip_levels
          WHERE min_volume_usdt <= ?
          ORDER BY min_volume_usdt DESC
          LIMIT 1`,
          [cumulativeVolume],
          (err, vipLevel) => {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error', details: err.message });
            }

            const currentVip = vipLevel || { vip_level: 0, vip_name: 'VIP 0', boost_percentage: 100 };

            // 3. 获取用户持有的最高等级 NFT
            db.get(
              `SELECT 
                MAX(n.id) as highest_nft_tier_id,
                n.name as nft_tier_name,
                n.power as nft_weight,
                nb.nft_level,
                nb.bonus_percentage as nft_boost
              FROM user_nfts un
              JOIN nodes n ON un.nft_tier_id = n.id
              LEFT JOIN nft_level_bonus nb ON nb.nft_tier_id = n.id
              WHERE un.user_address = ?
              GROUP BY un.user_address
              ORDER BY n.id DESC
              LIMIT 1`,
              [address],
              (err, nftData) => {
                if (err) {
                  db.close();
                  return res.status(500).json({ error: 'Database error', details: err.message });
                }

                const nftBoost = nftData?.nft_boost || 100; // 默认 100% 如果没有 NFT
                const nftLevel = nftData?.nft_level || 0;

                // 4. 计算总加成
                const totalBoost = currentVip.boost_percentage * nftBoost / 100;

                // 5. 获取基础配置
                db.get(
                  'SELECT base_rate, base_amount_usdt FROM swap_mining_config WHERE id = 1',
                  (err, config) => {
                    if (err) {
                      db.close();
                      return res.status(500).json({ error: 'Database error', details: err.message });
                    }

                    const baseRate = config?.base_rate || 0.003;
                    const baseAmount = config?.base_amount_usdt || 100;

                    // 6. 获取用户总收益
                    db.get(
                      `SELECT 
                        COALESCE(SUM(eagle_reward), 0) as total_earned,
                        COALESCE(SUM(CASE WHEN claimed = 1 THEN eagle_reward ELSE 0 END), 0) as total_claimed
                      FROM swap_mining_records
                      WHERE user_address = ?`,
                      [address],
                      (err, rewardData) => {
                        db.close();

                        if (err) {
                          return res.status(500).json({ error: 'Database error', details: err.message });
                        }

                        const totalEarned = rewardData?.total_earned || 0;
                        const totalClaimed = rewardData?.total_claimed || 0;
                        const pendingReward = totalEarned - totalClaimed;

                        // 7. 计算示例奖励
                        const rewardPer100Usdt = baseRate * currentVip.boost_percentage * nftBoost / 10000;

                        // 8. 获取下一个 VIP 等级信息
                        db.get(
                          `SELECT vip_level, vip_name, min_volume_usdt, boost_percentage
                          FROM vip_levels
                          WHERE vip_level = ?`,
                          [currentVip.vip_level + 1],
                          (err, nextVip) => {
                            const response = {
                              user_address: address,
                              cumulative_volume: cumulativeVolume,
                              total_trades: volumeData.total_trades,
                              vip: {
                                level: currentVip.vip_level,
                                name: currentVip.vip_name,
                                boost: currentVip.boost_percentage,
                                description: currentVip.description,
                                next_level: nextVip ? {
                                  level: nextVip.vip_level,
                                  name: nextVip.vip_name,
                                  required_volume: nextVip.min_volume_usdt,
                                  remaining_volume: Math.max(0, nextVip.min_volume_usdt - cumulativeVolume),
                                  boost: nextVip.boost_percentage
                                } : null
                              },
                              nft: {
                                level: nftLevel,
                                tier_name: nftData?.nft_tier_name || 'None',
                                boost: nftBoost,
                                weight: nftData?.nft_weight || 0
                              },
                              rewards: {
                                total_boost: totalBoost,
                                base_rate: baseRate,
                                base_amount: baseAmount,
                                reward_per_100_usdt: rewardPer100Usdt,
                                total_earned: totalEarned,
                                total_claimed: totalClaimed,
                                pending: pendingReward
                              },
                              examples: {
                                '100_usdt': rewardPer100Usdt,
                                '1000_usdt': rewardPer100Usdt * 10,
                                '10000_usdt': rewardPer100Usdt * 100
                              }
                            };

                            res.json(response);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    db.close();
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 获取所有 VIP 等级
router.get('/vip-levels', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.all('SELECT * FROM vip_levels ORDER BY vip_level', (err, rows) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(rows);
  });
});

// 获取所有 NFT 等级加成
router.get('/nft-boosts', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.all('SELECT * FROM nft_level_bonus ORDER BY nft_level', (err, rows) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(rows);
  });
});

// 获取奖励计算矩阵
router.get('/reward-matrix', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.all(
    `SELECT 
      v.vip_level,
      v.vip_name,
      v.boost_percentage as vip_boost,
      n.nft_level,
      n.nft_tier_name,
      n.bonus_percentage as nft_boost,
      (v.boost_percentage * n.bonus_percentage / 100) as total_boost,
      ROUND(0.003 * v.boost_percentage * n.bonus_percentage / 10000, 6) as eagle_per_100_usdt
    FROM vip_levels v
    CROSS JOIN nft_level_bonus n
    ORDER BY v.vip_level, n.nft_level`,
    (err, rows) => {
      db.close();
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
