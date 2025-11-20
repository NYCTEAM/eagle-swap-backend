-- ============================================
-- 分配配置表 - 解决早期不公平问题
-- ============================================

-- 创建分配配置表
CREATE TABLE IF NOT EXISTS allocation_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT OR REPLACE INTO allocation_config (config_key, config_value, description) VALUES
  -- 方案选择：'fixed_per_weight' | 'proportional_with_cap' | 'hybrid'
  ('allocation_method', 'fixed_per_weight', '分配方法：固定每权重 | 比例+上限 | 混合'),
  
  -- 固定每权重分配（方案1）
  ('fixed_allocation_per_weight', '0.1', '每权重每日固定分配（EAGLE）'),
  
  -- 比例分配的每日池（方案2）
  ('daily_allocation_pool', '10000', '每日总分配池（EAGLE）'),
  
  -- 每权重每日上限（方案2）
  ('max_allocation_per_weight', '0.5', '每权重每日最大分配（EAGLE）'),
  
  -- 最小参与门槛（方案3）
  ('min_total_weight_threshold', '1000', '切换到比例分配的最小总权重'),
  
  -- 合规声明
  ('allocation_disclaimer', 'true', '是否显示分配可变声明'),
  
  -- 调整历史记录
  ('last_adjustment_date', '', '最后一次参数调整日期'),
  ('last_adjustment_reason', '', '最后一次调整原因');

-- 创建每等级上限配置表
CREATE TABLE IF NOT EXISTS level_allocation_caps (
  level INTEGER PRIMARY KEY,
  daily_cap REAL NOT NULL,
  monthly_cap REAL,
  description TEXT,
  FOREIGN KEY (level) REFERENCES node_levels(id)
);

-- 插入每等级上限
INSERT OR REPLACE INTO level_allocation_caps (level, daily_cap, monthly_cap, description) VALUES
  (1, 0.05, 1.5, 'Micro Node - 每日上限'),
  (2, 0.15, 4.5, 'Mini Node - 每日上限'),
  (3, 0.25, 7.5, 'Bronze Node - 每日上限'),
  (4, 0.5, 15, 'Silver Node - 每日上限'),
  (5, 1.5, 45, 'Gold Node - 每日上限'),
  (6, 3.5, 105, 'Platinum Node - 每日上限'),
  (7, 7.5, 225, 'Diamond Node - 每日上限');

-- 创建分配历史记录表
CREATE TABLE IF NOT EXISTS allocation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  total_weight REAL NOT NULL,
  total_allocated REAL NOT NULL,
  allocation_method TEXT NOT NULL,
  avg_per_weight REAL,
  active_nodes_count INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_allocation_history_date ON allocation_history(date);
CREATE INDEX IF NOT EXISTS idx_allocation_config_key ON allocation_config(config_key);

-- 创建视图：当前配置摘要
CREATE VIEW IF NOT EXISTS current_allocation_config AS
SELECT 
  (SELECT config_value FROM allocation_config WHERE config_key = 'allocation_method') as method,
  (SELECT config_value FROM allocation_config WHERE config_key = 'fixed_allocation_per_weight') as fixed_per_weight,
  (SELECT config_value FROM allocation_config WHERE config_key = 'daily_allocation_pool') as daily_pool,
  (SELECT config_value FROM allocation_config WHERE config_key = 'max_allocation_per_weight') as max_per_weight,
  (SELECT config_value FROM allocation_config WHERE config_key = 'min_total_weight_threshold') as min_threshold;

-- 插入审计日志
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'ALLOCATION_CONFIG_CREATED',
  '创建分配配置系统，解决早期NFT销售少时的不公平问题。支持固定每权重分配、比例+上限、混合模式。'
);

SELECT 'Allocation config schema created successfully!' as status;
