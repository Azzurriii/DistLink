import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT, 10) || 6379,
	password: process.env.REDIS_PASSWORD || '',
	db: parseInt(process.env.REDIS_DB, 10) || 0,
	ttl: parseInt(process.env.REDIS_TTL, 10) || 3600, // 1 hour
	keyPrefix: 'distlink:',
}));
