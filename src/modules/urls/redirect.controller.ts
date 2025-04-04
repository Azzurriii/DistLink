import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { UrlsService } from './urls.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { ClicksService } from '../clicks/clicks.service';
import { Request, Response } from 'express';

@Controller()
export class RedirectController {
	constructor(
		private readonly urlsService: UrlsService,
		private readonly kafkaProducer: KafkaProducerService,
		private readonly clicksService: ClicksService,
	) {}

	@Get(':shortCode')
	async redirect(@Param('shortCode') shortCode: string, @Req() req: Request, @Res() res: Response) {
		try {
			const url = await this.urlsService.findByShortCode(shortCode);

			// Extract the real IP address considering various headers that might be set by proxies
			let ipAddress = '127.0.0.1';
			const forwardedHeader = req.headers['x-forwarded-for'];
			if (forwardedHeader) {
				// X-Forwarded-For can be a comma-separated list; the first IP is the original client
				ipAddress = (Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader)
					.split(',')[0]
					.trim();
			} else if (req.headers['cf-connecting-ip']) {
				// Cloudflare
				ipAddress = req.headers['cf-connecting-ip'] as string;
			} else if (req.headers['true-client-ip']) {
				// Akamai and others
				ipAddress = req.headers['true-client-ip'] as string;
			} else if (req.headers['x-real-ip']) {
				// Nginx proxy
				ipAddress = req.headers['x-real-ip'] as string;
			} else if (req.ip) {
				ipAddress = req.ip;
			}

			const userAgent = req.headers['user-agent'] || '';

			// Process click data through clicks service
			const clickResult = await this.clicksService.recordClick(shortCode, ipAddress, userAgent);

			// Also send click event to Kafka for async processing
			this.kafkaProducer
				.sendClickEvent(shortCode, {
					timestamp: clickResult.timestamp,
					userAgent,
					ip: ipAddress,
				})
				.catch((error) => {
					this.kafkaProducer.sendErrorEvent({
						code: 'CLICK_EVENT_ERROR',
						message: error.message,
						metadata: { shortCode },
					});
				});

			return res.redirect(url.original_url);
		} catch (error) {
			this.kafkaProducer.sendErrorEvent({
				code: 'REDIRECT_ERROR',
				message: error.message,
				metadata: { shortCode },
			});
			throw error;
		}
	}
}
