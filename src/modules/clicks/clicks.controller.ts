import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ClicksService } from './clicks.service';
import { ClickProcessorService } from './click-processor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('clicks')
export class ClicksController {
	constructor(
		private readonly clicksService: ClicksService,
		private readonly clickProcessor: ClickProcessorService,
	) {}

	@Get(':shortCode/analytics')
	@UseGuards(JwtAuthGuard)
	async getLinkAnalytics(
		@Param('shortCode') shortCode: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('includeRecent') includeRecent?: string,
		@Query('recentLimit') recentLimit?: string,
	) {
		// Set default date range if not provided (last 7 days)
		if (!startDate || !endDate) {
			const end = new Date();
			const start = new Date();
			start.setDate(start.getDate() - 7);

			startDate = start.toISOString().split('T')[0];
			endDate = end.toISOString().split('T')[0];
		}

		// Parse recent clicks limit (default 50)
		const parsedRecentLimit = recentLimit ? parseInt(recentLimit, 10) : 50;

		// Collect all analytics data in parallel
		const [totalClicks, dailyStats, countryStats, recentClicks] = await Promise.all([
			this.clicksService.getClickCount(shortCode, startDate, endDate),
			this.clicksService.getClicksByDateRange(shortCode, startDate, endDate),
			this.clicksService.getClicksByCountry(shortCode),
			includeRecent === 'true' ? this.clicksService.getRecentClicks(shortCode, parsedRecentLimit) : null,
		]);

		if (!totalClicks || totalClicks.totalClicks === 0) {
			throw new NotFoundException('No statistics found for this link or no clicks recorded');
		}

		// Build the comprehensive response
		const response: any = {
			shortCode,
			period: {
				startDate,
				endDate,
			},
			totalClicks: totalClicks.totalClicks,
			countryStats,
			dailyStats,
		};

		// Only include recent clicks if requested
		if (includeRecent === 'true') {
			response.recentClicks = recentClicks;
		}

		return response;
	}
}
