import { Injectable, Logger, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { ExpirationOption } from './dto/create-url.dto';
import { ShortCodeGenerator } from '../../utils/short-code.generator';
import { UpdateUrlDto } from './dto/update-url.dto';

@Injectable()
export class UrlsService {
	private readonly logger = new Logger(UrlsService.name);
	private readonly codePool: string[] = [];
	private static readonly RETRY_ATTEMPTS = 3;
	private static readonly BATCH_SIZE = 10;
	private readonly baseUrl: string;

	constructor(
		private readonly databaseService: DatabaseService,
		private readonly configService: ConfigService,
		private readonly redisService: RedisService,
	) {
		this.baseUrl = this.configService.get('BASE_URL');
		this.initializeCodePool();
	}

	private getRedisKey(key: string): string {
		return `${this.configService.get('redis.keyPrefix')}urls:${key}`;
	}

	private calculateExpirationDate(expiration: ExpirationOption): Date | null {
		if (expiration === ExpirationOption.FOREVER) return null;

		const now = new Date();
		const days =
			{
				[ExpirationOption.ONE_DAY]: 1,
				[ExpirationOption.SEVEN_DAYS]: 7,
				[ExpirationOption.THIRTY_DAYS]: 30,
			}[expiration] || 0;

		return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
	}

	private async initializeCodePool(): Promise<void> {
		this.codePool.push(...(await ShortCodeGenerator.generateBatch(UrlsService.BATCH_SIZE)));
	}

	private async getNextCode(): Promise<string> {
		if (this.codePool.length === 0) {
			await this.initializeCodePool();
		}
		return this.codePool.pop()!;
	}

	async create(dto: CreateUrlDto): Promise<UrlResponseDto> {
		const client = this.databaseService.getClient();
		const now = new Date();
		const expiresAt = this.calculateExpirationDate(dto.expiration);

		for (let attempt = 0; attempt < UrlsService.RETRY_ATTEMPTS; attempt++) {
			const shortCode = await this.getNextCode();
			try {
				await this.createUrlRecord(shortCode, dto.originalUrl, now, expiresAt);
				await this.invalidateMultipleKeys(['all']);
				return new UrlResponseDto({
					shortCode,
					originalUrl: dto.originalUrl,
					createdAt: now,
					expiresAt,
					clicks: 0,
					newUrl: this.generateNewUrl(shortCode),
				});
			} catch (error) {
				this.logger.error(`Attempt ${attempt + 1} failed: ${error.message}`);
			}
		}
		throw new Error('Failed to create short URL after multiple attempts');
	}

	async findByShortCode(shortCode: string): Promise<IUrl> {
		const cached = await this.getFromCache(shortCode);
		if (cached) return cached;

		const client = this.databaseService.getClient();
		const [urlResult, clicksResult] = await Promise.all([
			client.execute('SELECT * FROM urls WHERE short_code = ?', [shortCode], {
				prepare: true,
			}),
			client.execute('SELECT clicks FROM url_clicks WHERE short_code = ?', [shortCode], { prepare: true }),
		]);

		if (!urlResult.rows.length) {
			throw new NotFoundException('URL not found');
		}

		const url = urlResult.first();
		if (this.isExpired(url.expires_at)) {
			await this.remove(shortCode);
			throw new NotFoundException('URL has expired');
		}

		const urlData = {
			short_code: url.short_code,
			original_url: url.original_url,
			created_at: url.created_at,
			expires_at: url.expires_at,
			clicks: clicksResult.first()?.clicks || 0,
			new_url: `${this.baseUrl}${url.short_code}`,
		};

		await this.setCache(shortCode, urlData);
		return urlData;
	}

	async findAll(): Promise<UrlResponseDto[]> {
		const cached = await this.getFromCache('all');
		if (cached) return cached;

		const client = this.databaseService.getClient();
		const [urlsResult, clicksResult] = await Promise.all([
			client.execute('SELECT * FROM urls', [], { prepare: true }),
			client.execute('SELECT * FROM url_clicks', [], { prepare: true }),
		]);

		const clicksMap = new Map(clicksResult.rows.map((row) => [row.short_code, row.clicks || 0]));

		const urls = urlsResult.rows.map(
			(row) =>
				new UrlResponseDto({
					shortCode: row.short_code,
					originalUrl: row.original_url,
					createdAt: row.created_at,
					expiresAt: row.expires_at,
					clicks: clicksMap.get(row.short_code) || 0,
					newUrl: this.generateNewUrl(row.short_code),
				}),
		);

		await this.setCache('all', urls);
		return urls;
	}

	async remove(shortCode: string): Promise<void> {
		const client = this.databaseService.getClient();
		await Promise.all([
			client.execute('DELETE FROM urls WHERE short_code = ?', [shortCode], {
				prepare: true,
			}),
			client.execute('DELETE FROM url_clicks WHERE short_code = ?', [shortCode], { prepare: true }),
			this.redisService.del(this.getRedisKey(shortCode)),
			this.redisService.del(this.getRedisKey('all')),
		]);
	}

	async incrementClicks(shortCode: string): Promise<void> {
		const client = this.databaseService.getClient();
		await client.execute('UPDATE url_clicks SET clicks = clicks + 1 WHERE short_code = ?', [shortCode], {
			prepare: true,
		});
		await this.updateClicksInCache(shortCode);
	}

	async update(shortCode: string, updateUrlDto: UpdateUrlDto): Promise<UrlResponseDto> {
		try {
			const client = this.databaseService.getClient();
			const { newCode, expiration } = updateUrlDto;

			// Validate and find old URL
			const oldUrl = await this.findByShortCode(shortCode);
			if (!oldUrl) {
				throw new NotFoundException('URL not found');
			}

			// Check if newCode already exists
			const existingUrl = await client.execute('SELECT short_code FROM urls WHERE short_code = ?', [newCode], {
				prepare: true,
			});

			if (existingUrl.rows.length > 0) {
				throw new ConflictException('This custom short code is already taken');
			}

			// Perform update in transaction
			await this.createUrlRecord(
				newCode,
				oldUrl.original_url,
				oldUrl.created_at,
				expiration ? this.calculateExpirationDate(expiration) : oldUrl.expires_at,
			);

			await Promise.all([this.remove(shortCode), this.invalidateMultipleKeys(['all'])]);

			// Return response
			return new UrlResponseDto({
				shortCode: newCode,
				originalUrl: oldUrl.original_url,
				createdAt: oldUrl.created_at,
				expiresAt: oldUrl.expires_at,
				clicks: oldUrl.clicks,
				newUrl: this.generateNewUrl(newCode),
			});
		} catch (error) {
			this.logger.error(`Failed to update URL: ${error.message}`);
			if (error instanceof NotFoundException || error instanceof ConflictException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to update URL');
		}
	}

	private async getFromCache(key: string): Promise<any> {
		const data = await this.redisService.get(this.getRedisKey(key));
		return data ? JSON.parse(data) : null;
	}

	private async setCache(key: string, value: any): Promise<void> {
		await this.redisService.set(this.getRedisKey(key), JSON.stringify(value), this.configService.get('redis.ttl'));
	}

	private async updateClicksInCache(shortCode: string): Promise<void> {
		const cached = await this.getFromCache(shortCode);
		if (cached) {
			cached.clicks++;
			await this.setCache(shortCode, cached);
		}
	}

	private isExpired(expiresAt: Date | null): boolean {
		return expiresAt ? new Date() > expiresAt : false;
	}

	private generateNewUrl(shortCode: string): string {
		return `${this.baseUrl}/${shortCode}`;
	}

	private async invalidateMultipleKeys(keys: string[]): Promise<void> {
		await Promise.all(keys.map((key) => this.redisService.del(this.getRedisKey(key))));
	}

	private async createUrlRecord(
		shortCode: string,
		originalUrl: string,
		now: Date,
		expiresAt: Date | null,
	): Promise<void> {
		const client = this.databaseService.getClient();
		await Promise.all([
			client.execute(
				'INSERT INTO urls (short_code, original_url, created_at, expires_at) VALUES (?, ?, ?, ?) IF NOT EXISTS',
				[shortCode, originalUrl, now, expiresAt],
				{ prepare: true },
			),
			client.execute('UPDATE url_clicks SET clicks = clicks + 0 WHERE short_code = ?', [shortCode], {
				prepare: true,
			}),
		]);
	}
}
