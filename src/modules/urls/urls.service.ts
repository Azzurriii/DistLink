import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'cassandra-driver';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UrlsService {
  private readonly logger = new Logger(UrlsService.name);
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly CACHE_PREFIX = 'url:';
  private readonly redisKeyPrefix: string;
  private readonly redisTTL: number;

  constructor(
    private readonly databaseService: DatabaseService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    // Lấy cấu hình từ redis config
    this.redisKeyPrefix = this.configService.get('redis.keyPrefix');
    this.redisTTL = this.configService.get('redis.ttl');
  }

  private getRedisKey(key: string): string {
    return `${this.redisKeyPrefix}urls:${key}`;
  }

  async create(dto: CreateUrlDto): Promise<UrlResponseDto> {
    const client = this.databaseService.getClient();
    const shortCode = await this.generateUniqueShortCode();
    const now = new Date();
    const expiresAt = dto.expiresAt;

    await client.execute(
      `
      INSERT INTO urls (
        short_code,
        original_url,
        created_at,
        expires_at
      ) VALUES (?, ?, ?, ?)
      `,
      [shortCode, dto.originalUrl, now, expiresAt],
      { prepare: true }
    );

    await client.execute(
      `UPDATE url_clicks SET clicks = clicks + 0 WHERE short_code = ?`,
      [shortCode],
      { prepare: true }
    );

    // Invalidate the all_urls cache
    await this.redisService.del(this.getRedisKey('all'));

    return new UrlResponseDto({
      shortCode,
      originalUrl: dto.originalUrl,
      createdAt: now,
      expiresAt: dto.expiresAt,
      clicks: 0,
      newUrl: `${this.configService.get('BASE_URL')}/${shortCode}`,
    });
  }

  async findByShortCode(shortCode: string): Promise<IUrl> {
    const client = this.databaseService.getClient();

    const [urlResult, clicksResult] = await Promise.all([
      client.execute(
        'SELECT short_code, original_url, created_at, expires_at FROM urls WHERE short_code = ?',
        [shortCode],
        { prepare: true },
      ),
      client.execute(
        'UPDATE url_clicks SET clicks = clicks + 1 WHERE short_code = ?',
        [shortCode],
        { prepare: true },
      ),
    ]);

    if (!urlResult.rows.length) {
      throw new NotFoundException('URL not found');
    }

    const url = {
      short_code: urlResult.first().short_code,
      original_url: urlResult.first().original_url,
      created_at: urlResult.first().created_at,
      expires_at: urlResult.first().expires_at,
      clicks: clicksResult.first()?.clicks || 0,
      newUrl: `${this.configService.get('BASE_URL')}/${shortCode}`,
    } as IUrl;

    if (url.expires_at && url.expires_at < new Date()) {
      await client.execute(
        'DELETE FROM urls WHERE short_code = ?',
        [shortCode],
        { prepare: true }
      );
      
      await client.execute(
        'DELETE FROM url_clicks WHERE short_code = ?',
        [shortCode],
        { prepare: true }
      );
      
      throw new NotFoundException('URL has expired');
    }

    return url;
  }

  async remove(shortCode: string): Promise<void> {
    const client = this.databaseService.getClient();

    const checkResult = await client.execute(
      'SELECT short_code FROM urls WHERE short_code = ?',
      [shortCode],
      { prepare: true }
    );

    if (checkResult.rowLength === 0) {
      throw new NotFoundException('URL not found');
    }

    await client.execute(
      'DELETE FROM urls WHERE short_code = ?',
      [shortCode],
      { prepare: true }
    );

    await client.execute(
      'DELETE FROM url_clicks WHERE short_code = ?',
      [shortCode],
      { prepare: true }
    );

    // Invalidate both specific and list cache
    await this.redisService.del(this.getRedisKey(shortCode));
    await this.redisService.del(this.getRedisKey('all'));
  }

  private async generateUniqueShortCode(): Promise<string> {
    const client = this.databaseService.getClient();
    let shortCode: string;
    let exists: boolean;

    do {
      shortCode = this.generateShortCode();
      const result = await client.execute(
        'INSERT INTO urls (short_code) VALUES (?) IF NOT EXISTS',
        [shortCode],
        { prepare: true },
      );
      exists = !result.first().get('[applied]');

      if (exists) {
        await client.execute(
          'DELETE FROM urls WHERE short_code = ?',
          [shortCode],
          { prepare: true },
        );
      }
    } while (exists);

    return shortCode;
  }

  private generateShortCode(): string {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }

  async findAll(): Promise<UrlResponseDto[]> {
    const redisKey = this.getRedisKey('all');
    
    // Try to get from cache first
    const cachedUrls = await this.redisService.get(redisKey);
    if (cachedUrls) {
      return JSON.parse(cachedUrls);
    }

    // If not in cache, get from database
    const client = this.databaseService.getClient();
    const query = 'SELECT * FROM urls';
    const result = await client.execute(query, [], { prepare: true });
    
    const urls = await Promise.all(
      result.rows.map(async (row) => {
        const clicksResult = await client.execute(
          'SELECT clicks FROM url_clicks WHERE short_code = ?',
          [row.short_code],
          { prepare: true }
        );
        return {
          short_code: row.short_code,
          original_url: row.original_url,
          created_at: row.created_at,
          expires_at: row.expires_at,
          clicks: clicksResult.first()?.clicks || 0
        } as IUrl;
      }),
    );

    const response = urls.map(url => new UrlResponseDto({
      shortCode: url.short_code,
      originalUrl: url.original_url,
      createdAt: url.created_at,
      expiresAt: url.expires_at,
      clicks: url.clicks,
      newUrl: `${this.configService.get('BASE_URL')}/${url.short_code}`,
    }));

    // Store in cache
    await this.redisService.set(redisKey, JSON.stringify(response), this.redisTTL);
    return response;
  }

  async findOne(shortCode: string): Promise<UrlResponseDto> {
    const redisKey = this.getRedisKey(shortCode);
    
    // Try to get from cache first
    const cachedUrl = await this.redisService.get(redisKey);
    if (cachedUrl) {
      return JSON.parse(cachedUrl);
    }

    const url = await this.findByShortCode(shortCode);
    const response = new UrlResponseDto({
      shortCode: url.short_code,
      originalUrl: url.original_url,
      createdAt: url.created_at,
      expiresAt: url.expires_at,
      clicks: url.clicks,
      newUrl: `${this.configService.get('BASE_URL')}/${url.short_code}`,
    });

    // Store in cache
    await this.redisService.set(redisKey, JSON.stringify(response), this.redisTTL);
    return response;
  }

  async update(shortCode: string, updateUrlDto: CreateUrlDto): Promise<UrlResponseDto> {
    const url = await this.findByShortCode(shortCode);
    const now = new Date();
    const expiresAt = updateUrlDto.expiresAt;

    const client = this.databaseService.getClient();
    await client.execute(
      `
      UPDATE urls SET
        original_url = ?,
        created_at = ?,
        expires_at = ?
      WHERE short_code = ?
      `,
      [updateUrlDto.originalUrl, now, expiresAt, shortCode],
      { prepare: true }
    );

    await client.execute(
      `UPDATE url_clicks SET clicks = clicks + 0 WHERE short_code = ?`,
      [shortCode],
      { prepare: true }
    );

    // Invalidate both specific and list cache
    await this.redisService.del(this.getRedisKey(shortCode));
    await this.redisService.del(this.getRedisKey('all'));

    return new UrlResponseDto({
      shortCode,
      originalUrl: updateUrlDto.originalUrl,
      createdAt: now,
      expiresAt: expiresAt,
      clicks: 0,
      newUrl: `${this.configService.get('BASE_URL')}/${shortCode}`,
    });
  }
}
