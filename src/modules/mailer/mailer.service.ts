import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class MailerService {
	private transporter: nodemailer.Transporter;
	private readonly logger = new Logger(MailerService.name);
	private templates: Map<string, Handlebars.TemplateDelegate> = new Map();

	constructor(private readonly configService: ConfigService) {
		this.initializeTransporter();
		this.loadTemplates();
	}

	private initializeTransporter() {
		this.transporter = nodemailer.createTransport({
			host: this.configService.get('EMAIL_HOST'),
			port: this.configService.get('EMAIL_PORT') || 587,
			secure: false,
			auth: {
				user: this.configService.get('EMAIL_USER'),
				pass: this.configService.get('EMAIL_PASSWORD'),
			},
			tls: {
				rejectUnauthorized: false,
			},
		});

		this.transporter.verify((error, success) => {
			if (error) {
				this.logger.error('Email transporter verification failed:', error);
			} else {
				this.logger.log('Email transporter is ready to send messages');
			}
		});
	}

	private loadTemplates() {
		const templatesDir = path.join(process.cwd(), 'src/common/templates/emails');

		try {
			// Load verification email template
			const verificationTemplate = fs.readFileSync(path.join(templatesDir, 'active-email.hbs'), 'utf-8');
			this.templates.set('verification', Handlebars.compile(verificationTemplate));

			// Load password reset template
			const resetTemplate = fs.readFileSync(path.join(templatesDir, 'reset-password-email.hbs'), 'utf-8');
			this.templates.set('reset', Handlebars.compile(resetTemplate));

			this.logger.log('Email templates loaded successfully');
		} catch (error) {
			this.logger.error('Failed to load email templates', error);
		}
	}

	async sendVerificationEmail(to: string, name: string, verificationLink: string) {
		const template = this.templates.get('verification');

		if (!template) {
			this.logger.error('Verification email template not found');
			throw new Error('Email template not found');
		}

		const html = template({
			name,
			verificationLink,
			baseUrl: this.configService.get('BASE_URL'),
		});

		return this.sendMail({
			to,
			subject: 'Verify your email address',
			html,
		});
	}

	async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
		const template = this.templates.get('reset');

		if (!template) {
			this.logger.error('Password reset email template not found');
			throw new Error('Email template not found');
		}

		const html = template({
			name,
			resetLink,
			baseUrl: this.configService.get('BASE_URL'),
		});

		return this.sendMail({
			to,
			subject: 'Reset your password',
			html,
		});
	}

	private async sendMail(options: { to: string; subject: string; html: string; from?: string }) {
		const mailOptions = {
			from: options.from || this.configService.get('EMAIL_FROM'),
			to: options.to,
			subject: options.subject,
			html: options.html,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);
			this.logger.log(`Email sent: ${info.messageId}`);
			return info;
		} catch (error) {
			this.logger.error(`Failed to send email to ${options.to}`, error);
			throw error;
		}
	}
}
