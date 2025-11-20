const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./eagle_swap.db')

console.log('📊 Checking database structure...\n')

// 查看所有表
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error:', err)
    db.close()
    return
  }
  
  console.log('Tables:', tables.map(t => t.name).join(', '))
  console.log()
  
  // 查看每个表的结构和数据量
  let completed = 0
  tables.forEach(table => {
    db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
      if (err) {
        console.error(`Error getting info for ${table.name}:`, err)
      } else {
        console.log(`\n📋 Table: ${table.name}`)
        console.log('Columns:', columns.map(c => `${c.name} (${c.type})`).join(', '))
        
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
          if (!err) {
            console.log(`Rows: ${row.count}`)
          }
          
          completed++
          if (completed === tables.length) {
            db.close()
          }
        })
      }
    })
  })
})
