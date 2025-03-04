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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UrlsService } from './urls.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';

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

  @Get(':shortCode')
  @ApiOperation({ summary: 'Get URL by short code' })
  @ApiResponse({ status: 200, type: UrlResponseDto })
  @ApiResponse({ status: 404, description: 'URL not found' })
  async findOne(@Param('shortCode') shortCode: string) {
    const url = await this.urlsService.findByShortCode(shortCode);
    if (!url) {
      throw new NotFoundException('URL not found');
    }
    return url;
  }

  @Delete(':shortCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete URL by short code' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'URL deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'URL not found' })
  async remove(@Param('shortCode') shortCode: string): Promise<void> {
    await this.urlsService.remove(shortCode);
  }

  @Get()
  @ApiOperation({ summary: 'Get all URLs' })
  @ApiResponse({ status: 200, type: [UrlResponseDto] })
  async findAll() {
    return this.urlsService.findAll();
  }
}
