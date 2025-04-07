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
				CREATE TABLE IF NOT EXISTS link_urls (
					short_code text PRIMARY KEY,
					original_url text,
					user_id uuid,
					created_at timestamp,
					expires_at timestamp
				)
      		`);

			await this.client.execute(`
				CREATE INDEX IF NOT EXISTS link_urls_user_id_idx ON link_urls (user_id)
			`);

			await this.client.execute(`
				CREATE TABLE IF NOT EXISTS link_click_counter (
					short_code text PRIMARY KEY,
					clicks counter
				)
      		`);

			await this.client.execute(`
				CREATE TABLE IF NOT EXISTS link_users (
					id uuid PRIMARY KEY,
					email text,
					password text,
					full_name text,
					is_active boolean,
					google_id text,
					created_at timestamp,
					updated_at timestamp
				)
      		`);

			await this.client.execute(`
				CREATE INDEX IF NOT EXISTS link_users_email_idx ON link_users (email)
			`);

			await this.client.execute(`
				CREATE INDEX IF NOT EXISTS link_users_google_id_idx ON link_users (google_id)
			`);

			await this.client.execute(`
				CREATE TABLE IF NOT EXISTS link_click_events (
				  link_id text,
				  click_id uuid,
				  ip_address text,
				  country text,
				  clicked_at timestamp,
				  user_agent text,
				  PRIMARY KEY ((link_id), clicked_at, click_id)
				) WITH CLUSTERING ORDER BY (clicked_at DESC, click_id ASC)
			  `);

			await this.client.execute(`
				CREATE TABLE IF NOT EXISTS link_click_stats (
				  link_id text,
				  count_date date,
				  country text,
				  click_count counter,
				  PRIMARY KEY ((link_id), count_date, country)
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
