import { Module, forwardRef } from '@nestjs/common';
import { ClickProcessorService } from './click-processor.service';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { DatabaseModule } from '../database/database.module';
import { KafkaModule } from '../kafka/kafka.module';
import { ClicksService } from './clicks.service';
import { ClicksController } from './clicks.controller';

@Module({
	imports: [MonitoringModule, DatabaseModule, forwardRef(() => KafkaModule)],
	providers: [ClickProcessorService, ClicksService],
	controllers: [ClicksController],
	exports: [ClickProcessorService, ClicksService],
})
export class ClicksModule {}
