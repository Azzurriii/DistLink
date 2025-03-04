import { ApiProperty } from '@nestjs/swagger';

export class UrlResponseDto {
  @ApiProperty()
  shortCode: string;

  @ApiProperty()
  originalUrl: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty()
  clicks: number;

  @ApiProperty()
  newUrl: string;

  constructor(partial: Partial<UrlResponseDto>) {
    Object.assign(this, partial);
  }
}
