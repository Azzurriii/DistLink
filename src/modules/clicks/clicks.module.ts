import { Module } from '@nestjs/common';
import { ClickProcessorService } from './click-processor.service';

@Module({
  providers: [ClickProcessorService],
  exports: [ClickProcessorService],
})
export class ClicksModule {}
