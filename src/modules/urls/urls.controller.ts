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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UrlsService } from './urls.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { IUrl } from './interfaces/url.interface';
import { UpdateUrlDto } from './dto/update-url.dto';

@ApiTags('urls')
@Controller('urls')
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a short URL' })
  @ApiResponse({ status: 201, type: UrlResponseDto })
  async create(@Body() createUrlDto: CreateUrlDto): Promise<UrlResponseDto> {
    return this.urlsService.create(createUrlDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all URLs' })
  @ApiResponse({ status: 200, type: [UrlResponseDto] })
  async findAll(): Promise<UrlResponseDto[]> {
    return this.urlsService.findAll();
  }

  @Get(':shortCode')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete URL by short code' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'URL not found' })
  async remove(@Param('shortCode') shortCode: string): Promise<void> {
    await this.urlsService.remove(shortCode);
  }

  @Patch(':shortCode')
  @ApiOperation({ summary: 'Update URL by short code' })
  @ApiResponse({ status: 200, type: UrlResponseDto })
  @ApiResponse({ status: 404, description: 'URL not found' })
  async update(@Param('shortCode') shortCode: string, @Body() updateUrlDto: UpdateUrlDto): Promise<UrlResponseDto> {
    return this.urlsService.update(shortCode, updateUrlDto);
  }
}
