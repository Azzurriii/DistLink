import { Module } from '@nestjs/common';
import { UrlsService } from './urls.service';
import { UrlsController } from './urls.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { RedirectController } from './redirect.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [DatabaseModule, RedisModule, ScheduleModule.forRoot()],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService],
})
export class UrlsModule {}
