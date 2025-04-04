import { registerAs } from '@nestjs/config';

export default registerAs('safeBrowsing', () => ({
	apiKey: process.env.SAFE_BROWSING_API_KEY,
}));
