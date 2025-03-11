import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsEnum } from 'class-validator';

export enum ExpirationOption {
	FOREVER = 'FOREVER',
	ONE_DAY = '1D',
	SEVEN_DAYS = '7D',
	THIRTY_DAYS = '30D',
}

export class CreateUrlDto {
	@ApiProperty({
		description: 'Original URL to shorten',
		example: 'https://example.com/very-long-url',
	})
	@IsUrl()
	originalUrl: string;

	@ApiProperty({
		description: 'URL expiration option',
		enum: ExpirationOption,
		default: ExpirationOption.FOREVER,
	})
	@IsEnum(ExpirationOption)
	expiration: ExpirationOption = ExpirationOption.FOREVER;
}
