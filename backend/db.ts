const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yourpassword',
  database: 'product_drop',
});

module.exports = pool