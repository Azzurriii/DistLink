import { Module } from '@nestjs/common';
import { UrlsService } from './urls.service';
import { UrlsController } from './urls.controller';

@Module({
  controllers: [UrlsController],
  providers: [UrlsService],
})
export class UrlsModule {}
