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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UrlsService } from './urls.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { UpdateUrlDto } from './dto/update-url.dto';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

@ApiTags('urls')
@Controller('urls')
@UseGuards(RateLimitGuard)
@RateLimit({ limit: 1000, window: 3600 })
export class UrlsController {
	constructor(private readonly urlsService: UrlsService) {}

	@Post()
	@RateLimit({ limit: 10, window: 60 })
	@ApiOperation({ summary: 'Create a short URL' })
	@ApiResponse({ status: 201, type: UrlResponseDto })
	async create(@Body() createUrlDto: CreateUrlDto): Promise<UrlResponseDto> {
		return this.urlsService.create(createUrlDto);
	}

	@Get()
	@RateLimit({ limit: 100, window: 60 })
	@ApiOperation({ summary: 'Get all URLs' })
	@ApiResponse({ status: 200, type: [UrlResponseDto] })
	async findAll(): Promise<UrlResponseDto[]> {
		return this.urlsService.findAll();
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
	@RateLimit({ limit: 20, window: 60 })
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete URL by short code' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'URL not found' })
	async remove(@Param('shortCode') shortCode: string): Promise<void> {
		await this.urlsService.remove(shortCode);
	}

	@Patch(':shortCode')
	@RateLimit({ limit: 30, window: 60 })
	@ApiOperation({ summary: 'Update URL by short code' })
	@ApiResponse({ status: 200, type: UrlResponseDto })
	@ApiResponse({ status: 404, description: 'URL not found' })
	@ApiResponse({ status: 409, description: 'Custom code already taken' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async update(@Param('shortCode') shortCode: string, @Body() updateUrlDto: UpdateUrlDto): Promise<UrlResponseDto> {
		if (!/^[a-zA-Z0-9-_]{8,16}$/.test(shortCode)) {
			throw new BadRequestException('Invalid short code format');
		}

		return this.urlsService.update(shortCode, updateUrlDto);
	}
}
