-- 修复 NFT 加成倍数配置
-- 更新为正确的固定倍数

UPDATE nft_level_bonus SET bonus_multiplier = 1.05, description = 'Micro Node ($10, Power 0.1) - 1.05x (105%)' WHERE nft_level = 1;
UPDATE nft_level_bonus SET bonus_multiplier = 1.20, description = 'Mini Node ($25, Power 0.3) - 1.20x (120%)' WHERE nft_level = 2;
UPDATE nft_level_bonus SET bonus_multiplier = 1.35, description = 'Bronze Node ($50, Power 0.5) - 1.35x (135%)' WHERE nft_level = 3;
UPDATE nft_level_bonus SET bonus_multiplier = 1.50, description = 'Silver Node ($100, Power 1.0) - 1.50x (150%)' WHERE nft_level = 4;
UPDATE nft_level_bonus SET bonus_multiplier = 1.70, description = 'Gold Node ($250, Power 3.0) - 1.70x (170%)' WHERE nft_level = 5;
UPDATE nft_level_bonus SET bonus_multiplier = 1.85, description = 'Platinum Node ($500, Power 7.0) - 1.85x (185%)' WHERE nft_level = 6;
UPDATE nft_level_bonus SET bonus_multiplier = 2.50, description = 'Diamond Node ($1000, Power 15.0) - 2.50x (250%)' WHERE nft_level = 7;

-- 验证更新
SELECT * FROM nft_level_bonus ORDER BY nft_level;
