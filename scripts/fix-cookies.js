#!/usr/bin/env node
/**
 * 修复 Cookie 文件格式，确保所有字段都符合 Playwright 要求
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cookiePath = path.join(__dirname, '../preset/x_state.json');

console.log('🔧 修复 Cookie 文件格式...\n');

try {
  const cookiesData = fs.readFileSync(cookiePath, 'utf8');
  const cookies = JSON.parse(cookiesData);
  
  console.log(`📦 读取了 ${cookies.length} 个 Cookie`);
  
  // 修复每个 Cookie
  const fixedCookies = cookies.map((cookie, index) => {
    const fixed = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.x.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: cookie.httpOnly === true
    };
    
    // 修复 expires
    if (cookie.expires !== undefined && cookie.expires !== -1) {
      fixed.expires = Math.floor(cookie.expires);
    }
    
    // 修复 sameSite - 确保是有效值
    let sameSite = cookie.sameSite;
    if (!sameSite || sameSite === 'unspecified' || sameSite === 'no_restriction') {
      sameSite = 'None';
    }
    
    // 标准化 sameSite 值
    if (sameSite.toLowerCase() === 'strict') {
      fixed.sameSite = 'Strict';
    } else if (sameSite.toLowerCase() === 'lax') {
      fixed.sameSite = 'Lax';
    } else {
      fixed.sameSite = 'None';
    }
    
    // 如果 sameSite 是 None，必须是 secure
    if (fixed.sameSite === 'None') {
      fixed.secure = true;
    }
    
    return fixed;
  });
  
  // 保存修复后的 Cookie
  fs.writeFileSync(cookiePath, JSON.stringify(fixedCookies, null, 2));
  
  console.log(`✅ 已修复并保存 ${fixedCookies.length} 个 Cookie`);
  console.log(`📁 文件位置: ${cookiePath}\n`);
  
  // 验证
  console.log('🔍 验证 Cookie 格式...');
  let hasError = false;
  
  fixedCookies.forEach((cookie, index) => {
    if (!['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
      console.log(`❌ Cookie ${index} (${cookie.name}): 无效的 sameSite 值: ${cookie.sameSite}`);
      hasError = true;
    }
    if (cookie.sameSite === 'None' && !cookie.secure) {
      console.log(`❌ Cookie ${index} (${cookie.name}): sameSite=None 但 secure=false`);
      hasError = true;
    }
  });
  
  if (!hasError) {
    console.log('✅ 所有 Cookie 格式正确！\n');
  } else {
    console.log('❌ 发现格式错误\n');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  process.exit(1);
}
