const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./eagle_swap.db')

db.all(
  "SELECT name FROM sqlite_master WHERE type='table' AND (name='price_snapshots' OR name='candles')",
  (err, rows) => {
    if (err) {
      console.error('Error:', err)
    } else {
      console.log('✅ Chart tables found:', rows.map(r => r.name).join(', '))
      
      if (rows.length === 2) {
        console.log('\n🎉 Database is ready for chart data!')
        console.log('\n📝 Next steps:')
        console.log('1. Start the price collector service')
        console.log('2. Wait for data to accumulate')
        console.log('3. Check the chart on frontend')
      } else {
        console.log('\n❌ Tables not created properly')
      }
    }
    db.close()
  }
)
