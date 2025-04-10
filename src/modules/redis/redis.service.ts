import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit {
	private readonly logger = new Logger(RedisService.name);
	private client: Redis;

	constructor(private configService: ConfigService) {}

	async onModuleInit() {
		const redisConfig = this.configService.get('redis');

		this.client = new Redis({
			host: redisConfig.host,
			port: redisConfig.port,
			password: redisConfig.password,
			db: redisConfig.db,
		});

		try {
			await this.client.ping();
			this.logger.log('✅ Connected to Redis!');
		} catch (error) {
			this.logger.error('❌ Failed to connect to Redis:', error.message);
			throw error;
		}
	}

	async onModuleDestroy() {
		if (this.client) {
			await this.client.quit();
			this.logger.log('Disconnected from Redis');
		}
	}

	async set(key: string, value: string, ttl?: number) {
		await this.client.set(key, value, 'EX', ttl);
	}

	async get(key: string) {
		return await this.client.get(key);
	}

	async del(key: string) {
		await this.client.del(key);
	}

	async incr(key: string): Promise<number> {
		return this.client.incr(key);
	}

	async expire(key: string, seconds: number): Promise<void> {
		await this.client.expire(key, seconds);
	}
}
