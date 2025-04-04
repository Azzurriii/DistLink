import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UrlsCleanupService {
	private readonly logger = new Logger(UrlsCleanupService.name);

	constructor(
		private readonly databaseService: DatabaseService,
		private readonly redisService: RedisService,
	) {}

	@Cron(CronExpression.EVERY_HOUR)
	async cleanupExpiredUrls() {
		this.logger.log('Starting cleanup of expired URLs');
		const client = this.databaseService.getClient();

		try {
			const result = await client.execute(
				'SELECT short_code FROM link_urls WHERE expires_at < toTimestamp(now())',
				[],
				{ prepare: true },
			);

			if (result.rows.length === 0) {
				this.logger.log('No expired URLs found');
				return;
			}

			const expiredCodes = result.rows.map((row) => row.short_code);

			await Promise.all([
				...expiredCodes.map((code) =>
					client.execute('DELETE FROM link_urls WHERE short_code = ?', [code], {
						prepare: true,
					}),
				),
				...expiredCodes.map((code) =>
					client.execute('DELETE FROM link_click_counter WHERE short_code = ?', [code], { prepare: true }),
				),
				...expiredCodes.map((code) => this.redisService.del(`url:${code}`)),
			]);

			await this.redisService.del('url:all');

			this.logger.log(`Cleaned up ${expiredCodes.length} expired URLs`);
		} catch (error) {
			this.logger.error('Error during URL cleanup:', error);
		}
	}
}
