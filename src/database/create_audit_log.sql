-- 创建审计日志表
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  description TEXT,
  user_address TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_event_type 
  ON compliance_audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_created_at 
  ON compliance_audit_log(created_at);

SELECT '✅ 审计日志表已创建' as status;
