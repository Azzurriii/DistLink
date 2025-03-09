import { Module, forwardRef } from '@nestjs/common';
import { ClickProcessorService } from './click-processor.service';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { DatabaseModule } from '../database/database.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [MonitoringModule, DatabaseModule, forwardRef(() => KafkaModule)],
  providers: [ClickProcessorService],
  exports: [ClickProcessorService],
})
export class ClicksModule {}
