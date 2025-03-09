import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaAdminService implements OnModuleInit {
  private readonly kafka: Kafka;
  private readonly logger = new Logger(KafkaAdminService.name);

  constructor(private readonly configService: ConfigService) {
    const kafkaConfig = this.configService.get('kafka');
    this.kafka = new Kafka({
      clientId: `${kafkaConfig.clientId}-admin`,
      brokers: kafkaConfig.brokers,
      retry: {
        initialRetryTime: kafkaConfig.retry.initialRetryTime,
        retries: kafkaConfig.retry.retries,
      },
    });
  }

  async onModuleInit() {
    await this.ensureTopicsExist();
  }

  async ensureTopicsExist() {
    const admin = this.kafka.admin();
    let connected = false;
    let retries = 5;

    while (!connected && retries > 0) {
      try {
        await admin.connect();
        connected = true;
      } catch (error) {
        retries--;
        this.logger.warn(`Failed to connect to Kafka, retrying... (${retries} attempts left)`);
        if (retries === 0) {
          this.logger.error('Could not connect to Kafka after multiple attempts');
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    try {
      const topics = this.configService.get('kafka.topics');
      const topicList = [topics.urlClicks, topics.urlAnalytics, topics.urlErrors];
      
      const existingTopics = await admin.listTopics();
      
      const topicsToCreate = topicList.filter(topic => !existingTopics.includes(topic));
      
      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate.map(topic => ({
            topic,
            numPartitions: 3,         // Number of partitions
            replicationFactor: 1,     // Replication factor (1 cho dev, nên cao hơn cho prod)
            configEntries: [
              { name: 'retention.ms', value: '604800000' }  // Giữ messages 7 ngày
            ]
          }))
        });
        this.logger.log(`Created Kafka topics: ${topicsToCreate.join(', ')}`);
      } else {
        this.logger.log('All required Kafka topics already exist');
      }
      
      await admin.disconnect();
      return true;
    } catch (error) {
      this.logger.error('Failed to create Kafka topics', error);
      try {
        await admin.disconnect();
      } catch (e) {
        // Ignore disconnect errors
        this.logger.error('Failed to disconnect from Kafka', e);
      }
      return false;
    }
  }
} 