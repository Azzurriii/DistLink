import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UrlsModule } from './modules/urls/urls.module';

@Module({
  imports: [UrlsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
