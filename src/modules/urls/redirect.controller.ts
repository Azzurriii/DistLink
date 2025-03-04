import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { UrlsService } from './urls.service';

@Controller()
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortCode')
  async redirect(@Param('shortCode') shortCode: string, @Res() res: Response) {
    try {
      const url = await this.urlsService.findByShortCode(shortCode);
      await this.urlsService.incrementClicks(shortCode);
      return res.redirect(301, url.original_url);
    } catch (error) {
      throw new NotFoundException('Link not found or has expired');
    }
  }
}
