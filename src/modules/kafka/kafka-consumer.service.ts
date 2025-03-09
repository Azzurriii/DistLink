import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { ClickProcessorService } from '../clicks/click-processor.service';
import { KafkaProducerService } from './kafka-producer.service';
import { PrometheusService } from '../monitoring/prometheus.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly logger = new Logger(KafkaConsumerService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ClickProcessorService))
    private readonly clickProcessor: ClickProcessorService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly monitoring: PrometheusService,
  ) {
    const kafkaConfig = this.configService.get('kafka');
    this.kafka = new Kafka({
      clientId: `${kafkaConfig.clientId}-consumer`,
      brokers: kafkaConfig.brokers,
      retry: {
        initialRetryTime: kafkaConfig.retry.initialRetryTime,
        retries: kafkaConfig.retry.retries,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: kafkaConfig.groupId,
    });
  }

  async onModuleInit() {
    let retries = 3;
    while (retries > 0) {
      try {
        await this.consumer.connect();
        await this.setupSubscriptions();
        this.logger.log('Kafka Consumer connected successfully');
        return;
      } catch (error) {
        retries--;
        if (retries === 0) {
          this.logger.error(
            'Failed to connect Kafka Consumer after multiple attempts',
            error,
          );
          this.logger.warn(
            'Application will continue without Kafka consumer functionality',
          );
          return; // Không throw error để ứng dụng vẫn chạy được
        }

        this.logger.warn(
          `Kafka consumer connection failed, retrying... (${retries} attempts left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async setupSubscriptions() {
    const topics = this.configService.get('kafka.topics');

    // Subscribe to click events
    await this.consumer.subscribe({
      topic: topics.urlClicks,
      fromBeginning: false,
    });

    // Subscribe to analytics events
    await this.consumer.subscribe({
      topic: topics.urlAnalytics,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const startTime = Date.now();
        try {
          const event = JSON.parse(message.value.toString());
          this.monitoring.incrementCounter('kafka_messages_received');

          switch (topic) {
            case topics.urlClicks:
              await this.clickProcessor.processClickEvent(event);
              break;
            case topics.urlAnalytics:
              await this.clickProcessor.processAnalyticsEvent(event);
              break;
            default:
              this.logger.warn(`No handler for topic: ${topic}`);
          }

          this.monitoring.observeHistogram(
            'message_processing_time',
            Date.now() - startTime,
          );
        } catch (error) {
          this.monitoring.incrementCounter('message_processing_errors');
          this.logger.error(
            `Error processing message from topic ${topic}, partition ${partition}`,
            error,
          );

          await this.kafkaProducer.sendErrorEvent({
            code: 'PROCESSING_ERROR',
            message: error.message,
            metadata: {
              topic,
              partition,
              messageKey: message.key?.toString(),
            },
          });
        }
      },
    });
  }
}
