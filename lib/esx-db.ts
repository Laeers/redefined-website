import mysql from "mysql2/promise";

const HOST = process.env.ESX_DB_HOST ?? process.env.DB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ESX_DB_PORT ?? process.env.DB_PORT ?? "3306");
const USER = process.env.ESX_DB_USER ?? "root";
const PASSWORD = process.env.ESX_DB_PASSWORD ?? "";
const DATABASE = process.env.ESX_DB_NAME ?? "essential";

declare global {
  var __esxDbPool: mysql.Pool | undefined;
}

function makePool() {
  return mysql.createPool({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    // DB'en (es_extended/zaki_logs) gemmer vægur-tid i server-lokal zone
    // (MariaDB time_zone=SYSTEM=Europe/Berlin), IKKE UTC. Med "Z" læste
    // mysql2 14:56 som UTC og viste 16:56 (+2t). "local" = Node-processens
    // zone (Europe/Berlin), DST-sikkert.
    timezone: "local",
    charset: "utf8mb4_unicode_ci",
  });
}

export function getEsxPool(): mysql.Pool {
  if (!global.__esxDbPool) {
    global.__esxDbPool = makePool();
  }
  return global.__esxDbPool;
}
