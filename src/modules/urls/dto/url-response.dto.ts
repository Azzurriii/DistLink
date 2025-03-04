import { ApiProperty } from '@nestjs/swagger';

export class UrlResponseDto {
  @ApiProperty({
    example: 'abc123',
    description: 'Generated short code',
  })
  shortCode: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Original URL',
  })
  originalUrl: string;

  @ApiProperty({
    example: 'https://short.url/abc123',
    description: 'Full shortened URL',
  })
  shortenedUrl: string;

  @ApiProperty({
    example: '2024-03-04T12:00:00Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-04-04T12:00:00Z',
    description: 'Expiration timestamp',
    required: false,
  })
  expiresAt?: Date;

  @ApiProperty({
    example: 0,
    description: 'Number of clicks',
  })
  clicks: number;

  constructor(data: {
    shortCode: string;
    originalUrl: string;
    createdAt: Date;
    expiresAt?: Date;
    clicks: number;
  }) {
    this.shortCode = data.shortCode;
    this.originalUrl = data.originalUrl;
    this.createdAt = data.createdAt;
    this.expiresAt = data.expiresAt;
    this.clicks = data.clicks;
    this.shortenedUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/${this.shortCode}`;
  }
}
