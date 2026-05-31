const fs = require('fs');
const { Pool } = require('pg');

// 数据库连接配置（直接连接，增长超时时间）
const pool = new Pool({
  user: 'postgres',
  password: '@nnsz2018060',
  host: 'db.fhdcoiuquxyutbxyvecg.supabase.co',
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 1  // 单连接避免并发问题
});

async function importData() {
  const client = await pool.connect();
  
  try {
    console.log('读取 SQL 文件...');
    const sql = fs.readFileSync('scripts/data/forbidden_city.import.sql', 'utf-8');
    
    console.log('开始执行导入...');
    console.log(`SQL 文件大小: ${(fs.statSync('scripts/data/forbidden_city.import.sql').size / 1024 / 1024).toFixed(2)} MB`);
    
    // 设置所有错误停止
    await client.query('SET client_min_messages = WARNING');
    
    // 执行 SQL
    const startTime = Date.now();
    await client.query(sql);
    const endTime = Date.now();
    
    console.log(`✅ 导入完成! 耗时: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);
    
    // 验证导入结果
    console.log('\n验证导入的数据行数:');
    const tables = ['buildings', 'facilities', 'roads', 'indoor_paths'];
    
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const count = result.rows[0].count;
      console.log(`  - ${table}: ${count} 行`);
    }
    
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    if (error.detail) console.error('   详情:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

importData();
