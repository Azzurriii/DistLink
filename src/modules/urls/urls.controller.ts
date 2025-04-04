import {
	Controller,
	Get,
	Post,
	Delete,
	Body,
	Param,
	NotFoundException,
	HttpCode,
	HttpStatus,
	Patch,
	BadRequestException,
	UseGuards,
	Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UrlsService } from './urls.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { UpdateUrlDto } from './dto/update-url.dto';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('urls')
@Controller('urls')
@UseGuards(RateLimitGuard)
@RateLimit({ limit: 1000, window: 3600 })
export class UrlsController {
	constructor(private readonly urlsService: UrlsService) {}

	@Post()
	@UseGuards(OptionalJwtAuthGuard)
	@ApiBearerAuth()
	@RateLimit({ limit: 10, window: 60 })
	@ApiOperation({ summary: 'Create a short URL' })
	@ApiResponse({ status: 201, type: UrlResponseDto })
	@ApiResponse({ status: 400, description: 'URL identified as potentially harmful by Google Safe Browsing' })
	async create(@Body() createUrlDto: CreateUrlDto, @Request() req): Promise<UrlResponseDto> {
		let userId = null;
		if (req.user && req.user.id) {
			userId = req.user.id.toString();
		}

		return this.urlsService.create(createUrlDto, userId);
	}

	@Get()
	@RateLimit({ limit: 100, window: 60 })
	@ApiOperation({ summary: 'Get all URLs' })
	@ApiResponse({ status: 200, type: [UrlResponseDto] })
	async findAll(): Promise<UrlResponseDto[]> {
		return this.urlsService.findAll();
	}

	@Get('user')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@RateLimit({ limit: 100, window: 60 })
	@ApiOperation({ summary: 'Get URLs by authenticated user' })
	@ApiResponse({ status: 200, type: [UrlResponseDto] })
	async findByUser(@Request() req): Promise<UrlResponseDto[]> {
		const userId = req.user.id.toString();
		return this.urlsService.findByUserId(userId);
	}

	@Get(':shortCode')
	@RateLimit({ limit: 200, window: 60 })
	@ApiOperation({ summary: 'Get URL details by short code' })
	@ApiResponse({ status: 200, type: UrlResponseDto })
	@ApiResponse({ status: 404, description: 'URL not found or expired' })
	async findOne(@Param('shortCode') shortCode: string): Promise<IUrl> {
		const url = await this.urlsService.findByShortCode(shortCode);

		if (!url) {
			throw new NotFoundException('URL not found');
		}

		if (url.expires_at && new Date() > url.expires_at) {
			throw new NotFoundException('URL has expired');
		}

		return url;
	}

	@Delete(':shortCode')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@RateLimit({ limit: 20, window: 60 })
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete URL by short code' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'URL not found' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not authorized to delete this URL' })
	async remove(@Param('shortCode') shortCode: string, @Request() req): Promise<void> {
		const url = await this.urlsService.findByShortCode(shortCode);
		const userId = req.user.id.toString();

		if (url.user_id && url.user_id !== userId) {
			throw new BadRequestException('You are not authorized to delete this URL');
		}

		await this.urlsService.remove(shortCode);
	}

	@Patch(':shortCode')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@RateLimit({ limit: 30, window: 60 })
	@ApiOperation({ summary: 'Update URL by short code' })
	@ApiResponse({ status: 200, type: UrlResponseDto })
	@ApiResponse({ status: 404, description: 'URL not found' })
	@ApiResponse({ status: 409, description: 'Custom code already taken' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiResponse({
		status: 400,
		description: 'Invalid short code format or URL identified as potentially harmful by Google Safe Browsing',
	})
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not authorized to update this URL' })
	async update(
		@Param('shortCode') shortCode: string,
		@Body() updateUrlDto: UpdateUrlDto,
		@Request() req,
	): Promise<UrlResponseDto> {
		if (!/^[a-zA-Z0-9-_]{8,16}$/.test(shortCode)) {
			throw new BadRequestException('Invalid short code format');
		}

		const url = await this.urlsService.findByShortCode(shortCode);
		const userId = req.user.id.toString();

		if (url.user_id && url.user_id !== userId) {
			throw new BadRequestException('You are not authorized to update this URL');
		}

		return this.urlsService.update(shortCode, updateUrlDto);
	}
}
