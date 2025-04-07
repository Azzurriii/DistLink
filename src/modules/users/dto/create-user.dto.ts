import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
		message:
			'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
	})
	@IsOptional()
	password?: string;

	@IsString()
	@IsNotEmpty()
	fullName: string;

	@IsString()
	@IsOptional()
	googleId?: string;

	@IsOptional()
	isActive?: boolean;
}
