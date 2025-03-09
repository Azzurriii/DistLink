import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaAdminService } from './kafka-admin.service';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ClicksModule } from '../clicks/clicks.module';

@Module({
  imports: [ConfigModule, MonitoringModule, forwardRef(() => ClicksModule)],
  providers: [KafkaAdminService, KafkaProducerService, KafkaConsumerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
