import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './modules/database/database.service';
import { RedisService } from './modules/redis/redis.service';
import { ClickHouseService } from './modules/clickhouse/clickhouse.service';
import configs from './configs';
import { validate } from './configs/validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UrlsModule } from './modules/urls/urls.module';
import { RedisModule } from './modules/redis/redis.module';
import { KafkaProducerService } from './modules/kafka/kafka-producer.service';
import { KafkaModule } from './modules/kafka/kafka.module';
import { ClickProcessorService } from './modules/clicks/click-processor.service';
import { ClicksModule } from './modules/clicks/clicks.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './modules/database/database.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { QueueModule } from './modules/queue/queue.module';
import { SafeBrowsingModule } from './modules/safe-browsing/safe-browsing.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: configs,
			validate,
			cache: true,
		}),
		UrlsModule,
		RedisModule,
		KafkaModule,
		ClicksModule,
		MonitoringModule,
		AuthModule,
		UsersModule,
		DatabaseModule,
		MailerModule,
		QueueModule,
		SafeBrowsingModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		DatabaseService,
		RedisService,
		KafkaProducerService,
		ClickHouseService,
		ClickProcessorService,
	],
})
export class AppModule {}
