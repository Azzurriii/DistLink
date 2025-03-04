import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUrlDto {
  @ApiProperty({
    example: 'https://example.com',
    description: 'The URL to be shortened',
  })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @Transform(({ value }) => value.trim())
  originalUrl: string;

  @ApiProperty({
    example: '2024-04-04T12:00:00Z',
    description: 'Optional expiration date',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value ? new Date(value) : null))
  expiresAt?: Date;
}
