import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.DB_PORT ?? "3306");
const USER = process.env.DB_USER ?? "redefined_web";
const PASSWORD = process.env.DB_PASSWORD ?? "";
const DATABASE = process.env.DB_NAME ?? "redefined_web";

declare global {
   
  var __redefinedDbPool: mysql.Pool | undefined;
}

function makePool() {
  return mysql.createPool({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    timezone: "Z",
    charset: "utf8mb4_unicode_ci",
  });
}

export function getPool(): mysql.Pool {
  if (!global.__redefinedDbPool) {
    global.__redefinedDbPool = makePool();
  }
  return global.__redefinedDbPool;
}
