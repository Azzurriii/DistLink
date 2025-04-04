import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

@Injectable()
export class ClicksService {
	private readonly logger = new Logger(ClicksService.name);
	private countryCache = new Map<string, { country: string; timestamp: number }>();
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
	private lastRequestTime = 0;
	private readonly REQUEST_DELAY = 1000; // 1 second between requests to avoid rate limiting

	constructor(private readonly databaseService: DatabaseService) {}

	async recordClick(linkId: string, ipAddress: string, userAgent: string) {
		const client = this.databaseService.getClient();
		const clickId = uuidv4();
		const now = new Date();

		// Get country info with caching and rate limiting
		let country = await this.getCountryWithCache(ipAddress);

		// Store the click event
		await client.execute(
			`INSERT INTO link_click_events (link_id, click_id, ip_address, country, clicked_at, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
			[linkId, clickId, ipAddress, country, now, userAgent],
			{ prepare: true },
		);

		// Update click stats by date and country
		const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
		await client.execute(
			`UPDATE link_click_stats SET click_count = click_count + 1 
       WHERE link_id = ? AND count_date = ? AND country = ?`,
			[linkId, dateStr, country],
			{ prepare: true },
		);

		return { clickId, timestamp: now };
	}

	private async getCountryWithCache(ipAddress: string): Promise<string> {
		if (this.isLocalIpAddress(ipAddress)) {
			return 'Local Development';
		}

		// Check if we have a cached result
		const cached = this.countryCache.get(ipAddress);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			return cached.country;
		}

		// Implement rate limiting
		const now = Date.now();
		if (now - this.lastRequestTime < this.REQUEST_DELAY) {
			// If we're being rate limited and have no cache, return default
			if (!cached) {
				return 'Unknown';
			}
			// If we have a cached value but it's old, still use it
			return cached.country;
		}

		this.lastRequestTime = now;

		try {
			console.log('ipAddress', ipAddress);
			const response = await axios.get(`http://ip-api.com/json/${ipAddress}`);
			const country = response.data && response.data.country ? response.data.country : 'Unknown';
			console.log('country', country);
			// Cache the result
			this.countryCache.set(ipAddress, { country, timestamp: Date.now() });
			return country;
		} catch (error) {
			this.logger.warn(`Error getting country information: ${error.message}`);

			// If we have an old cached value, use it instead of 'Unknown'
			if (cached) {
				return cached.country;
			}

			return 'Unknown';
		}
	}

	private isLocalIpAddress(ip: string): boolean {
		// IPv4 local addresses
		if (
			ip === '127.0.0.1' ||
			ip.startsWith('10.') ||
			ip.startsWith('192.168.') ||
			ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
		) {
			return true;
		}

		// IPv6 local addresses
		if (
			ip === '::1' || // IPv6 loopback
			ip.toLowerCase().startsWith('fc') || // IPv6 unique local
			ip.toLowerCase().startsWith('fd') || // IPv6 unique local
			ip.toLowerCase().startsWith('fe80') // IPv6 link local
		) {
			return true;
		}

		return false;
	}

	async getClickStats(linkId: string, startDate?: string, endDate?: string) {
		const client = this.databaseService.getClient();
		let query = `SELECT * FROM link_click_events WHERE link_id = ?`;
		const params = [linkId];

		if (startDate && endDate) {
			query += ` AND clicked_at >= ? AND clicked_at <= ?`;
			params.push(startDate, endDate);
		}

		const result = await client.execute(query, params, { prepare: true });
		return result.rows;
	}

	async getClickCount(linkId: string, startDate?: string, endDate?: string) {
		const client = this.databaseService.getClient();

		if (!startDate && !endDate) {
			const result = await client.execute(
				`SELECT SUM(click_count) as total_clicks FROM link_click_stats WHERE link_id = ?`,
				[linkId],
				{ prepare: true },
			);
			return { totalClicks: result.first()?.total_clicks || 0 };
		}

		let query = `SELECT COUNT(*) as count FROM link_click_events WHERE link_id = ?`;
		const params = [linkId];

		if (startDate) {
			query += ` AND clicked_at >= ?`;
			params.push(startDate);
		}

		if (endDate) {
			query += ` AND clicked_at <= ?`;
			params.push(endDate);
		}

		const result = await client.execute(query, params, { prepare: true });
		return { totalClicks: result.first()?.count || 0 };
	}

	async getClicksByCountry(linkId: string) {
		const client = this.databaseService.getClient();

		const result = await client.execute(
			`SELECT country, SUM(click_count) as clicks 
       FROM link_click_stats 
       WHERE link_id = ? 
       GROUP BY country`,
			[linkId],
			{ prepare: true },
		);

		return result.rows.map((row) => ({
			country: row.country,
			clicks: row.clicks,
		}));
	}

	async getRecentClicks(linkId: string, limit: number = 100) {
		const client = this.databaseService.getClient();

		const result = await client.execute(
			`SELECT click_id, ip_address, country, clicked_at, user_agent
       FROM link_click_events 
       WHERE link_id = ? 
       LIMIT ?`,
			[linkId, limit],
			{ prepare: true },
		);

		return result.rows;
	}

	async getClicksByDateRange(linkId: string, startDate: string, endDate: string) {
		const client = this.databaseService.getClient();

		const start = new Date(startDate);
		const end = new Date(endDate);
		const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day

		const dates = [];
		for (let dt = new Date(start); dt <= end; dt = new Date(dt.getTime() + oneDay)) {
			dates.push(dt.toISOString().split('T')[0]);
		}

		const query = `
      SELECT count_date, country, click_count
      FROM link_click_stats
      WHERE link_id = ? AND count_date IN ?
    `;

		const result = await client.execute(query, [linkId, dates], { prepare: true });

		const dailyData = {};
		result.rows.forEach((row) => {
			const dateStr = row.count_date.toISOString().split('T')[0];
			if (!dailyData[dateStr]) {
				dailyData[dateStr] = {
					date: dateStr,
					totalClicks: 0,
					countries: {},
				};
			}

			dailyData[dateStr].countries[row.country] = row.click_count;
			dailyData[dateStr].totalClicks += row.click_count;
		});

		return Object.values(dailyData);
	}
}
