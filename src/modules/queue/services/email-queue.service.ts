import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class EmailQueueService {
	private readonly logger = new Logger(EmailQueueService.name);

	constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

	async addVerificationEmailJob(to: string, name: string, verificationLink: string) {
		try {
			const job = await this.emailQueue.add(
				'verification',
				{
					to,
					name,
					verificationLink,
				},
				{
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
					removeOnComplete: true,
				},
			);
			this.logger.log(`Added verification email job ${job.id} to queue`);
			return job;
		} catch (error) {
			this.logger.error('Failed to add verification email job to queue', error.stack);
			throw error;
		}
	}

	async addPasswordResetEmailJob(to: string, name: string, resetLink: string) {
		try {
			const job = await this.emailQueue.add(
				'password-reset',
				{
					to,
					name,
					resetLink,
				},
				{
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
					removeOnComplete: true,
				},
			);
			this.logger.log(`Added password reset email job ${job.id} to queue`);
			return job;
		} catch (error) {
			this.logger.error('Failed to add password reset email job to queue', error.stack);
			throw error;
		}
	}
}
