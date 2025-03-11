import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
	rateLimit: {
		ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
		limit: parseInt(process.env.RATE_LIMIT_LIMIT, 10) || 100,
	},
	safeBrowsing: {
		apiKey: process.env.SAFE_BROWSING_API_KEY,
		apiUrl: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
	},
	urlValidation: {
		maxLength: 2048,
		allowedProtocols: ['http:', 'https:'],
		blacklistedDomains: [],
	},
}));
