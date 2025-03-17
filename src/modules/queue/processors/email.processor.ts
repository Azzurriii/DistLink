import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MailerService } from '../../mailer/mailer.service';

@Processor('email')
export class EmailProcessor {
	private readonly logger = new Logger(EmailProcessor.name);

	constructor(private readonly mailerService: MailerService) {}

	@Process('verification')
	async handleVerificationEmail(job: Job<{ to: string; name: string; verificationLink: string }>) {
		this.logger.debug(`Processing verification email job ${job.id}`);
		try {
			await this.mailerService.sendVerificationEmail(job.data.to, job.data.name, job.data.verificationLink);
			this.logger.log(`Verification email sent to ${job.data.to}`);
			return true;
		} catch (error) {
			this.logger.error(`Failed to send verification email to ${job.data.to}`, error.stack);
			throw error;
		}
	}

	@Process('password-reset')
	async handlePasswordResetEmail(job: Job<{ to: string; name: string; resetLink: string }>) {
		this.logger.debug(`Processing password reset email job ${job.id}`);
		try {
			await this.mailerService.sendPasswordResetEmail(job.data.to, job.data.name, job.data.resetLink);
			this.logger.log(`Password reset email sent to ${job.data.to}`);
			return true;
		} catch (error) {
			this.logger.error(`Failed to send password reset email to ${job.data.to}`, error.stack);
			throw error;
		}
	}
}
