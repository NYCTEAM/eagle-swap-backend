-- 修正 NFT 等级加成值
-- 正确的加成：105%, 120%, 135%, 150%, 170%, 185%, 250%

UPDATE nft_level_bonus SET bonus_percentage = 105 WHERE nft_level = 1;
UPDATE nft_level_bonus SET bonus_percentage = 120 WHERE nft_level = 2;
UPDATE nft_level_bonus SET bonus_percentage = 135 WHERE nft_level = 3;
UPDATE nft_level_bonus SET bonus_percentage = 150 WHERE nft_level = 4;
UPDATE nft_level_bonus SET bonus_percentage = 170 WHERE nft_level = 5;
UPDATE nft_level_bonus SET bonus_percentage = 185 WHERE nft_level = 6;
UPDATE nft_level_bonus SET bonus_percentage = 250 WHERE nft_level = 7;

-- 更新描述
UPDATE nft_level_bonus SET description = 'NFT Level 1 - 105% boost multiplier' WHERE nft_level = 1;
UPDATE nft_level_bonus SET description = 'NFT Level 2 - 120% boost multiplier' WHERE nft_level = 2;
UPDATE nft_level_bonus SET description = 'NFT Level 3 - 135% boost multiplier' WHERE nft_level = 3;
UPDATE nft_level_bonus SET description = 'NFT Level 4 - 150% boost multiplier' WHERE nft_level = 4;
UPDATE nft_level_bonus SET description = 'NFT Level 5 - 170% boost multiplier' WHERE nft_level = 5;
UPDATE nft_level_bonus SET description = 'NFT Level 6 - 185% boost multiplier' WHERE nft_level = 6;
UPDATE nft_level_bonus SET description = 'NFT Level 7 - 250% boost multiplier' WHERE nft_level = 7;

-- 验证更新
SELECT * FROM nft_level_bonus ORDER BY nft_level;
