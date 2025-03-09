import { Module } from '@nestjs/common';
import { UrlsService } from './urls.service';
import { UrlsController } from './urls.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { RedirectController } from './redirect.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    KafkaModule
  ],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService, RateLimitGuard, Reflector],
})
export class UrlsModule {}
