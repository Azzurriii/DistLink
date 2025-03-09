import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { UrlsService } from './urls.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { Request, Response } from 'express';

@Controller()
export class RedirectController {
  constructor(
    private readonly urlsService: UrlsService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  @Get(':shortCode')
  async redirect(
    @Param('shortCode') shortCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const url = await this.urlsService.findByShortCode(shortCode);

      // Emit click event asynchronously
      this.kafkaProducer
        .sendClickEvent(shortCode, {
          timestamp: new Date(),
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          referer: req.headers.referer,
        })
        .catch((error) => {
          this.kafkaProducer.sendErrorEvent({
            code: 'CLICK_EVENT_ERROR',
            message: error.message,
            metadata: { shortCode },
          });
        });

      return res.redirect(url.original_url);
    } catch (error) {
      this.kafkaProducer.sendErrorEvent({
        code: 'REDIRECT_ERROR',
        message: error.message,
        metadata: { shortCode },
      });
      throw error;
    }
  }
}
