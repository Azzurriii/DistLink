import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@clickhouse/client';

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const clickhouseConfig = this.configService.get('clickhouse');

    // First connect without database
    this.client = createClient({
      url: `http://${clickhouseConfig.host}:${clickhouseConfig.port}`,
      username: clickhouseConfig.username,
      password: clickhouseConfig.password,
    });

    try {
      await this.client.ping();
      this.logger.log('✅ Connected to ClickHouse!');

      // Create database
      await this.createDatabase();

      // Reconnect with database
      this.client = createClient({
        url: `http://${clickhouseConfig.host}:${clickhouseConfig.port}`,
        database: clickhouseConfig.database,
        username: clickhouseConfig.username,
        password: clickhouseConfig.password,
      });

      // Create tables
      await this.createTables();
    } catch (error) {
      this.logger.error('❌ Failed to connect to ClickHouse:', error.message);
      throw error;
    }
  }

  private async createDatabase() {
    const database = this.configService.get('clickhouse.database');
    await this.client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${database}`,
    });
    this.logger.log('✅ Created/Verified ClickHouse Database');
  }

  private async createTables() {
    await this.client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS url_clicks (
          short_code String,
          click_time DateTime,
          ip_address String,
          user_agent String,
          referrer String
        ) ENGINE = MergeTree()
        ORDER BY (short_code, click_time)
      `,
    });
    this.logger.log('✅ Created/Verified ClickHouse Tables');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.logger.log('Disconnected from ClickHouse');
    }
  }
}
