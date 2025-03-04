import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUrlDto {
  @ApiProperty({
    description: 'Original URL to shorten',
    example: 'https://example.com/very-long-url'
  })
  @IsUrl()
  originalUrl: string;

  @ApiProperty({
    description: 'Expiration date for the URL',
    required: false,
    example: '2025-03-04T00:00:00.000Z'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
