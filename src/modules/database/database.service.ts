import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'cassandra-driver';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private client: Client;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const dbConfig = this.configService.get('database');

    this.client = new Client({
      contactPoints: [`${dbConfig.host}:${dbConfig.port}`],
      localDataCenter: dbConfig.localDataCenter,
      credentials: {
        username: dbConfig.username,
        password: dbConfig.password,
      },
    });

    try {
      await this.client.connect();
      this.logger.log('✅ Connected to ScyllaDB!');

      // Create keyspace
      await this.createKeyspace();
    } catch (error) {
      this.logger.error('❌ Failed to connect to ScyllaDB:', error.message);
      throw error;
    }
  }

  private async createKeyspace() {
    const keyspace = this.configService.get('database.keyspace');
    await this.client.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${keyspace}
      WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);
    await this.client.execute(`USE ${keyspace}`);
    this.logger.log('✅ Created/Verified Keyspace');

    await this.initializeTables();
  }

  private async initializeTables() {
    try {
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS urls (
          short_code text PRIMARY KEY,
          original_url text,
          created_at timestamp,
          expires_at timestamp
        )
      `);

      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS url_clicks (
          short_code text PRIMARY KEY,
          clicks counter
        )
      `);

      this.logger.log('✅ Created/Verified Tables');
    } catch (error) {
      this.logger.error('❌ Failed to create tables:', error.message);
      throw error;
    }
  }

  getClient(): Client {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown();
      this.logger.log('Disconnected from ScyllaDB');
    }
  }
}
