import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'cassandra-driver';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UrlsService {
  private readonly logger = new Logger(UrlsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private configService: ConfigService,
  ) {}

  async create(dto: CreateUrlDto): Promise<UrlResponseDto> {
    const client = this.databaseService.getClient();
    const shortCode = await this.generateUniqueShortCode();
    const now = new Date();

    const batchQueries = [
      {
        query: `
          INSERT INTO urls (
            short_code,
            original_url,
            created_at,
            expires_at
          ) VALUES (?, ?, ?, ?)
        `,
        params: [shortCode, dto.originalUrl, now, dto.expiresAt],
      },
      {
        query: `
          UPDATE url_clicks 
          SET clicks = clicks + 0 
          WHERE short_code = ?
        `,
        params: [shortCode],
      },
    ];

    await client.batch(batchQueries, { prepare: true });

    return new UrlResponseDto({
      shortCode,
      originalUrl: dto.originalUrl,
      createdAt: now,
      expiresAt: dto.expiresAt,
      clicks: 0,
    });
  }

  async findByShortCode(shortCode: string): Promise<IUrl> {
    const client = this.databaseService.getClient();

    // Perform parallel queries to optimize performance
    const [urlResult, clicksResult] = await Promise.all([
      client.execute(
        'SELECT short_code, original_url, created_at, expires_at FROM urls WHERE short_code = ?',
        [shortCode],
        { prepare: true },
      ),
      client.execute(
        'UPDATE url_clicks SET clicks = clicks + 1 WHERE short_code = ? IF EXISTS',
        [shortCode],
        { prepare: true },
      ),
    ]);

    if (!urlResult.rows.length) {
      throw new NotFoundException('URL not found');
    }

    const url = {
      ...urlResult.first().toJSON(),
      clicks: clicksResult.first()?.clicks || 0,
    } as IUrl;

    if (url.expires_at && url.expires_at < new Date()) {
      // Use BATCH to ensure atomic operation
      const batchQueries = [
        {
          query: 'DELETE FROM urls WHERE short_code = ?',
          params: [shortCode],
        },
        {
          query: 'DELETE FROM url_clicks WHERE short_code = ?',
          params: [shortCode],
        },
      ];
      await client.batch(batchQueries, { prepare: true });
      throw new NotFoundException('URL has expired');
    }

    return url;
  }

  async remove(shortCode: string): Promise<void> {
    const client = this.databaseService.getClient();

    // Use BATCH to ensure atomic operation
    const batchQueries = [
      {
        query: 'DELETE FROM urls WHERE short_code = ?',
        params: [shortCode],
      },
      {
        query: 'DELETE FROM url_clicks WHERE short_code = ?',
        params: [shortCode],
      },
    ];

    await client.batch(batchQueries, { prepare: true });
  }

  private async generateUniqueShortCode(): Promise<string> {
    const client = this.databaseService.getClient();
    let shortCode: string;
    let exists: boolean;

    do {
      shortCode = this.generateShortCode();
      // Use lightweight transaction (LWT) with IF NOT EXISTS
      const result = await client.execute(
        'INSERT INTO urls (short_code) VALUES (?) IF NOT EXISTS',
        [shortCode],
        { prepare: true },
      );
      exists = !result.first().get('[applied]');

      if (exists) {
        // If exists, delete the recently inserted record
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
}
