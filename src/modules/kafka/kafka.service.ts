import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit {
  private readonly logger = new Logger(KafkaService.name);
  private client: Kafka;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const kafkaConfig = this.configService.get('kafka');
    
    this.client = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });

    try {
      const admin = this.client.admin();
      await admin.connect();
      await admin.listTopics();
      this.logger.log('✅ Connected to Kafka!');
      
      // Create topics if they don't exist
      await this.createTopics();
      await admin.disconnect();
    } catch (error) {
      this.logger.error('❌ Failed to connect to Kafka:', error.message);
      throw error;
    }
  }

  private async createTopics() {
    const admin = this.client.admin();
    const topics = Object.values(this.configService.get('kafka.topics'));
    
    await admin.createTopics({
      topics: topics.map(topic => ({
        topic: topic as string,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });
    
    this.logger.log('✅ Created/Verified Kafka Topics');
  }

  async onModuleDestroy() {
    if (this.client) {
      const admin = this.client.admin();
      await admin.disconnect();
      this.logger.log('Disconnected from Kafka');
    }
  }
} 