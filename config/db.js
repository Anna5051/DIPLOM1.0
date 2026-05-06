const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

db.connect((err) => {
  if (err) {
    console.error(
      "БД: не удалось подключиться при старте —",
      err.code || err.message,
    );
    process.exit(1);
  }
});

module.exports = db;