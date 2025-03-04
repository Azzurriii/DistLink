import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'cassandra-driver';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { ExpirationOption } from './dto/create-url.dto';

@Injectable()
export class UrlsService {
  private readonly logger = new Logger(UrlsService.name);
  private readonly redisKeyPrefix: string;
  private readonly redisTTL: number;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.redisKeyPrefix = this.configService.get('redis.keyPrefix');
    this.redisTTL = this.configService.get('redis.ttl');
  }

  private getRedisKey(key: string): string {
    return `${this.redisKeyPrefix}urls:${key}`;
  }

  private calculateExpirationDate(expiration: ExpirationOption): Date | null {
    if (expiration === ExpirationOption.FOREVER) {
      return null;
    }

    const now = new Date();
    switch (expiration) {
      case ExpirationOption.ONE_DAY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case ExpirationOption.SEVEN_DAYS:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case ExpirationOption.THIRTY_DAYS:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  async create(dto: CreateUrlDto): Promise<UrlResponseDto> {
    const client = this.databaseService.getClient();
    const shortCode = await this.generateUniqueShortCode();
    const now = new Date();
    const expiresAt = this.calculateExpirationDate(dto.expiration);

    await client.execute(
      'INSERT INTO urls (short_code, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)',
      [shortCode, dto.originalUrl, now, expiresAt],
      { prepare: true },
    );

    await client.execute(
      'UPDATE url_clicks SET clicks = clicks + 0 WHERE short_code = ?',
      [shortCode],
      { prepare: true },
    );

    await this.invalidateCache('all');

    return this.createUrlResponse(
      shortCode,
      dto.originalUrl,
      now,
      expiresAt,
      0,
    );
  }

  async findByShortCode(shortCode: string): Promise<IUrl> {
    const cachedUrl = await this.getFromCache(shortCode);
    if (cachedUrl) return cachedUrl;

    const url = await this.getUrlFromDatabase(shortCode);
    if (!url) throw new NotFoundException('URL not found');

    if (this.isExpired(url.expires_at)) {
      await this.remove(shortCode);
      throw new NotFoundException('URL has expired');
    }

    await this.setCache(shortCode, url);
    return url;
  }

  async findAll(): Promise<UrlResponseDto[]> {
    const cachedUrls = await this.getFromCache('all');
    if (cachedUrls) return cachedUrls;

    const urls = await this.getAllUrlsFromDatabase();
    await this.setCache('all', urls);
    return urls;
  }

  async remove(shortCode: string): Promise<void> {
    const client = this.databaseService.getClient();
    const exists = await this.urlExists(shortCode);

    if (!exists) {
      throw new NotFoundException('URL not found');
    }

    await Promise.all([
      client.execute('DELETE FROM urls WHERE short_code = ?', [shortCode], {
        prepare: true,
      }),
      client.execute(
        'DELETE FROM url_clicks WHERE short_code = ?',
        [shortCode],
        { prepare: true },
      ),
      this.invalidateCache(shortCode),
      this.invalidateCache('all'),
    ]);
  }

  async incrementClicks(shortCode: string): Promise<void> {
    const client = this.databaseService.getClient();
    await client.execute(
      'UPDATE url_clicks SET clicks = clicks + 1 WHERE short_code = ?',
      [shortCode],
      { prepare: true },
    );

    await this.updateClicksInCache(shortCode);
  }

  private async getFromCache(key: string): Promise<any> {
    const cached = await this.redisService.get(this.getRedisKey(key));
    return cached ? JSON.parse(cached) : null;
  }

  private async setCache(key: string, value: any): Promise<void> {
    await this.redisService.set(
      this.getRedisKey(key),
      JSON.stringify(value),
      this.redisTTL,
    );
  }

  private async invalidateCache(key: string): Promise<void> {
    await this.redisService.del(this.getRedisKey(key));
  }

  private async updateClicksInCache(shortCode: string): Promise<void> {
    const cached = await this.getFromCache(shortCode);
    if (cached) {
      cached.clicks += 1;
      await this.setCache(shortCode, cached);
    }
  }

  private createUrlResponse(
    shortCode: string,
    originalUrl: string,
    createdAt: Date,
    expiresAt: Date | null,
    clicks: number,
  ): UrlResponseDto {
    return new UrlResponseDto({
      shortCode,
      originalUrl,
      createdAt,
      expiresAt,
      clicks,
      newUrl: `${this.configService.get('BASE_URL')}/${shortCode}`,
    });
  }

  private isExpired(expiresAt: Date | null): boolean {
    return expiresAt ? new Date() > expiresAt : false;
  }

  private async urlExists(shortCode: string): Promise<boolean> {
    const client = this.databaseService.getClient();
    const result = await client.execute(
      'SELECT short_code FROM urls WHERE short_code = ?',
      [shortCode],
      { prepare: true },
    );
    return result.rowLength > 0;
  }

  private async generateUniqueShortCode(): Promise<string> {
    const client = this.databaseService.getClient();
    let shortCode: string;
    let exists: boolean;

    do {
      shortCode = this.generateShortCode();
      const result = await client.execute(
        'SELECT short_code FROM urls WHERE short_code = ?',
        [shortCode],
        { prepare: true },
      );
      exists = result.rowLength > 0;
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

  private async getUrlFromDatabase(shortCode: string): Promise<IUrl | null> {
    const client = this.databaseService.getClient();
    const [urlResult, clicksResult] = await Promise.all([
      client.execute('SELECT * FROM urls WHERE short_code = ?', [shortCode], {
        prepare: true,
      }),
      client.execute(
        'SELECT clicks FROM url_clicks WHERE short_code = ?',
        [shortCode],
        { prepare: true },
      ),
    ]);

    if (!urlResult.rows.length) return null;

    const url = urlResult.first();
    return {
      short_code: url.short_code,
      original_url: url.original_url,
      created_at: url.created_at,
      expires_at: url.expires_at,
      clicks: clicksResult.first()?.clicks || 0,
      new_url: `${this.configService.get('BASE_URL')}/${url.short_code}`,
    };
  }

  private async getAllUrlsFromDatabase(): Promise<UrlResponseDto[]> {
    const client = this.databaseService.getClient();
    const result = await client.execute('SELECT * FROM urls', [], {
      prepare: true,
    });

    const urls = await Promise.all(
      result.rows.map(async (row) => {
        const clicksResult = await client.execute(
          'SELECT clicks FROM url_clicks WHERE short_code = ?',
          [row.short_code],
          { prepare: true },
        );

        return this.createUrlResponse(
          row.short_code,
          row.original_url,
          row.created_at,
          row.expires_at,
          clicksResult.first()?.clicks || 0,
        );
      }),
    );

    return urls;
  }
}
