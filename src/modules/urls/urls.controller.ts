import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Redirect,
  HttpStatus,
  HttpCode,
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
  @ApiOperation({ summary: 'Create a shortened URL' })
  @ApiResponse({ status: HttpStatus.CREATED, type: UrlResponseDto })
  async create(@Body() createUrlDto: CreateUrlDto): Promise<UrlResponseDto> {
    return this.urlsService.create(createUrlDto);
  }

  @Get(':shortCode')
  @ApiOperation({ summary: 'Redirect to original URL' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to original URL',
  })
  @Redirect()
  async redirect(@Param('shortCode') shortCode: string) {
    const url = await this.urlsService.findByShortCode(shortCode);
    return { url: url.original_url };
  }

  @Delete(':shortCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a URL' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(@Param('shortCode') shortCode: string): Promise<void> {
    await this.urlsService.remove(shortCode);
  }
}
