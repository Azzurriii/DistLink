import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './modules/database/database.service';
import { RedisService } from './modules/redis/redis.service';
import { KafkaService } from './modules/kafka/kafka.service';
import { ClickHouseService } from './modules/clickhouse/clickhouse.service';
import configs from './configs';
import { validate } from './configs/validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UrlsModule } from './modules/urls/urls.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      validate,
      cache: true,
    }),
    UrlsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseService,
    RedisService,
    KafkaService,
    ClickHouseService,
  ],
})
export class AppModule {}
