import { IsString, Matches, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExpirationOption } from './create-url.dto';

export class UpdateUrlDto {
	@IsOptional()
	@IsString()
	@Matches(/^[a-zA-Z0-9-_]{8,16}$/, {
		message:
			'Custom short code must be 8-16 characters long and can only contain letters, numbers, hyphens and underscores',
	})
	@ApiProperty({ required: true, description: 'New custom short code' })
	newCode: string;

	@IsOptional()
	@ApiProperty({ enum: ExpirationOption })
	expiration?: ExpirationOption;

	@IsOptional()
	@IsUrl()
	@ApiProperty({
		required: false,
		description: 'New URL to use (when updating an existing shortened URL)',
	})
	originalUrl?: string;
}
