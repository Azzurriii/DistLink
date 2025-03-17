import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '../mailer/mailer.module';
import { EmailProcessor } from './processors/email.processor';
import { EmailQueueService } from './services/email-queue.service';

@Module({
	imports: [
		BullModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				redis: {
					host: configService.get('REDIS_HOST'),
					port: configService.get('REDIS_PORT'),
					password: configService.get('REDIS_PASSWORD') || undefined,
				},
			}),
		}),
		BullModule.registerQueue({
			name: 'email',
		}),
		MailerModule,
	],
	providers: [EmailProcessor, EmailQueueService],
	exports: [EmailQueueService],
})
export class QueueModule {}
