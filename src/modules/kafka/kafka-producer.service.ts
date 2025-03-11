import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../monitoring/prometheus.service';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
	private readonly kafka: Kafka;
	private readonly producer: Producer;
	private readonly logger = new Logger(KafkaProducerService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly monitoring: PrometheusService,
	) {
		const kafkaConfig = this.configService.get('kafka');
		this.kafka = new Kafka({
			clientId: kafkaConfig.clientId,
			brokers: kafkaConfig.brokers,
			retry: {
				initialRetryTime: kafkaConfig.retry.initialRetryTime,
				retries: kafkaConfig.retry.retries,
			},
		});
		this.producer = this.kafka.producer();
	}

	async onModuleInit() {
		try {
			await this.producer.connect();
			this.logger.log('Kafka Producer connected successfully');
		} catch (error) {
			this.logger.error('Failed to connect Kafka Producer', error);
			throw error;
		}
	}

	async onModuleDestroy() {
		await this.producer.disconnect();
	}

	async sendClickEvent(shortCode: string, metadata: any) {
		const topics = this.configService.get('kafka.topics');
		const message = {
			key: shortCode,
			value: JSON.stringify({
				shortCode,
				timestamp: new Date(),
				metadata,
			}),
		};

		try {
			await this.producer.send({
				topic: topics.urlClicks,
				messages: [message],
			});

			this.monitoring.incrementCounter('kafka_messages_sent');
			this.logger.debug(`Sent click event for ${shortCode}`);
			return true;
		} catch (error) {
			this.monitoring.incrementCounter('kafka_errors');
			this.logger.error(`Failed to send click event for ${shortCode}`, error);

			// Send to error topic but don't fail if this also errors
			this.sendErrorEvent({
				code: 'CLICK_EVENT_ERROR',
				message: error.message,
				metadata: { shortCode },
			}).catch((e) => this.logger.error('Failed to send error event', e));

			throw error;
		}
	}

	async sendAnalyticsEvent(shortCode: string, metadata: any) {
		const topics = this.configService.get('kafka.topics');
		const message = {
			key: shortCode,
			value: JSON.stringify({
				shortCode,
				timestamp: new Date(),
				metadata,
			}),
		};

		try {
			await this.producer.send({
				topic: topics.urlAnalytics,
				messages: [message],
			});

			this.monitoring.incrementCounter('kafka_analytics_sent');
			return true;
		} catch (error) {
			this.monitoring.incrementCounter('kafka_errors');
			this.logger.error(`Failed to send analytics event for ${shortCode}`, error);

			// Send to error topic
			this.sendErrorEvent({
				code: 'ANALYTICS_EVENT_ERROR',
				message: error.message,
				metadata: { shortCode },
			}).catch((e) => this.logger.error('Failed to send error event', e));

			throw error;
		}
	}

	async sendErrorEvent(error: { code: string; message: string; metadata?: any }) {
		const topic = this.configService.get('kafka.topics.urlErrors');
		try {
			await this.producer.send({
				topic,
				messages: [
					{
						key: error.code,
						value: JSON.stringify({
							...error,
							timestamp: new Date(),
						}),
					},
				],
			});
			return true;
		} catch (err) {
			this.logger.error('Failed to send error event', err);
			return false;
		}
	}
}
