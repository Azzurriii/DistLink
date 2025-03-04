import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { UrlsService } from './urls.service';
import { Response } from 'express';

@Controller()
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortCode')
  async redirect(
    @Param('shortCode') shortCode: string,
    @Res() res: Response
  ) {
    const url = await this.urlsService.findByShortCode(shortCode);
    
    if (!url) {
      throw new NotFoundException('Short URL not found');
    }

    if (url.expires_at && new Date() > url.expires_at) {
      throw new NotFoundException('URL has expired');
    }

    await this.urlsService.incrementClicks(shortCode);

    return res.redirect(301, url.original_url);
  }
} 