import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SafeBrowsingService {
	private readonly logger = new Logger(SafeBrowsingService.name);
	private readonly apiKey: string;
	private readonly apiUrl = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

	constructor(private readonly configService: ConfigService) {
		this.apiKey =
			this.configService.get<string>('SAFE_BROWSING_API_KEY') ||
			this.configService.get<string>('safeBrowsing.apiKey');
		if (!this.apiKey) {
			this.logger.warn('Google Safe Browsing API key is not configured');
		} else {
			this.logger.log('Google Safe Browsing protection is enabled');
		}
	}

	/**
	 * Check if a URL is safe using Google Safe Browsing API
	 * @param url URL to check
	 * @returns Promise<{isSafe: boolean, threats?: any[]}>
	 */
	async checkUrl(url: string): Promise<{ isSafe: boolean; threats?: any[] }> {
		if (!this.apiKey) {
			this.logger.warn('Safe Browsing check skipped - API key not configured');
			return { isSafe: true };
		}

		try {
			const response = await axios.post(`${this.apiUrl}?key=${this.apiKey}`, {
				client: {
					clientId: 'distlink-url-shortener',
					clientVersion: '1.0.0',
				},
				threatInfo: {
					threatTypes: [
						'MALWARE',
						'SOCIAL_ENGINEERING',
						'UNWANTED_SOFTWARE',
						'POTENTIALLY_HARMFUL_APPLICATION',
					],
					platformTypes: ['ANY_PLATFORM'],
					threatEntryTypes: ['URL'],
					threatEntries: [{ url }],
				},
			});

			// If matches array is empty, no threats were found
			const threats = response.data.matches || [];
			return {
				isSafe: threats.length === 0,
				threats: threats.length > 0 ? threats : undefined,
			};
		} catch (error) {
			this.logger.error(`Error checking URL safety: ${error.message}`);
			return { isSafe: true };
		}
	}
}
