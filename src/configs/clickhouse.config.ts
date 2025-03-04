import { registerAs } from '@nestjs/config';

export default registerAs('clickhouse', () => ({
  host: process.env.CLICKHOUSE_HOST || 'localhost',
  port: parseInt(process.env.CLICKHOUSE_PORT, 10) || 8123,
  database: process.env.CLICKHOUSE_DATABASE || 'distlink',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  compression: true,
  timeout: 30000,
}));
