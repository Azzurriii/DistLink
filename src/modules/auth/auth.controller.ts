import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiBearerAuth,
	ApiParam,
	ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './guards/google-auth.guard';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'User login' })
	@ApiResponse({
		status: 200,
		description: 'Login successful',
		schema: {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
						email: { type: 'string', example: 'tuanthanh2408qb@gmail.com' },
						fullName: { type: 'string', example: 'Thanh Vo' },
						isActive: { type: 'boolean', example: true },
						createdAt: { type: 'string', example: '2025-03-16T14:30:00.000Z' },
						updatedAt: { type: 'string', example: '2025-03-16T14:30:00.000Z' },
					},
				},
				accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
				refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
			},
		},
	})
	@ApiResponse({ status: 401, description: 'Invalid credentials' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['email', 'password'],
			properties: {
				email: {
					type: 'string',
					example: 'tuanthanh2408qb@gmail.com',
				},
				password: {
					type: 'string',
					example: 'StrongP@ssw0rd',
				},
			},
		},
	})
	async login(@Body() loginDto: { email: string; password: string }) {
		return this.authService.login(loginDto.email, loginDto.password);
	}

	@Post('register')
	@ApiOperation({ summary: 'User registration' })
	@ApiResponse({
		status: 201,
		description: 'Registration successful',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'Registration successful. Please check your email to verify your account.',
				},
				user: {
					type: 'object',
					properties: {
						id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
						email: { type: 'string', example: 'tuanthanh2408qb@gmail.com' },
						fullName: { type: 'string', example: 'Thanh Vo' },
					},
				},
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Bad request' })
	@ApiResponse({ status: 409, description: 'User with this email already exists' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['email', 'password', 'fullName'],
			properties: {
				email: {
					type: 'string',
					example: 'tuanthanh2408qb@gmail.com',
					description: 'User email address',
				},
				password: {
					type: 'string',
					example: 'StrongP@ssw0rd',
					description: 'User password (min 8 characters)',
				},
				fullName: {
					type: 'string',
					example: 'Thanh Vo',
					description: 'User full name',
				},
			},
		},
	})
	async register(@Body() registerDto: { email: string; password: string; fullName: string }) {
		return this.authService.register(registerDto);
	}

	@Post('verify-email')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Verify email address' })
	@ApiResponse({ status: 200, description: 'Email verified successfully' })
	@ApiResponse({ status: 400, description: 'Invalid or expired token' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['token'],
			properties: {
				token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
			},
		},
	})
	async verifyEmail(@Body() verifyEmailDto: { token: string }) {
		return this.authService.verifyEmail(verifyEmailDto.token);
	}

	@Post('refresh-token')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Refresh access token' })
	@ApiResponse({
		status: 200,
		description: 'Token refreshed successfully',
		schema: {
			type: 'object',
			properties: {
				accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
				refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
			},
		},
	})
	@ApiResponse({ status: 401, description: 'Invalid refresh token' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['refreshToken'],
			properties: {
				refreshToken: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
				},
			},
		},
	})
	async refreshToken(@Body() refreshTokenDto: { refreshToken: string }) {
		return this.authService.refreshToken(refreshTokenDto.refreshToken);
	}

	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'User logout' })
	@ApiResponse({
		status: 200,
		description: 'Logged out successfully',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Logged out successfully' },
			},
		},
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async logout(@Req() req: Request) {
		return this.authService.logout(req.user['id']);
	}

	@Post('forgot-password')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Request password reset' })
	@ApiResponse({
		status: 200,
		description: 'Password reset email sent',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'If your email is registered, you will receive a password reset link',
				},
			},
		},
	})
	@ApiBody({
		schema: {
			type: 'object',
			required: ['email'],
			properties: {
				email: {
					type: 'string',
					example: 'tuanthanh2408qb@gmail.com',
				},
			},
		},
	})
	async forgotPassword(@Body() forgotPasswordDto: { email: string }) {
		return this.authService.forgotPassword(forgotPasswordDto.email);
	}

	@Post('reset-password')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Reset password with token' })
	@ApiResponse({
		status: 200,
		description: 'Password reset successful',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Password reset successful' },
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Invalid or expired token' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['token', 'newPassword'],
			properties: {
				token: {
					type: 'string',
					example: '550e8400-e29b-41d4-a716-446655440000',
				},
				newPassword: {
					type: 'string',
					example: 'NewStrongP@ssw0rd',
				},
			},
		},
	})
	async resetPassword(@Body() resetPasswordDto: { token: string; newPassword: string }) {
		return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get current user profile' })
	@ApiResponse({
		status: 200,
		description: 'User profile',
		schema: {
			type: 'object',
			properties: {
				id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
				email: { type: 'string', example: 'tuanthanh2408qb@gmail.com' },
				fullName: { type: 'string', example: 'Thanh Vo' },
				isActive: { type: 'boolean', example: true },
				createdAt: { type: 'string', example: '2025-03-16T14:30:00.000Z' },
				updatedAt: { type: 'string', example: '2025-03-16T14:30:00.000Z' },
			},
		},
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getProfile(@Req() req: Request) {
		return req.user;
	}

	@Get('check-token')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Check if token is valid' })
	@ApiResponse({
		status: 200,
		description: 'Token is valid',
		schema: {
			type: 'object',
			properties: {
				valid: { type: 'boolean', example: true },
			},
		},
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async checkToken() {
		return { valid: true };
	}

	@Post('change-password')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Change password' })
	@ApiResponse({
		status: 200,
		description: 'Password changed successfully',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Password changed successfully' },
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Current password is incorrect' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['currentPassword', 'newPassword'],
			properties: {
				currentPassword: {
					type: 'string',
					example: 'StrongP@ssw0rd',
				},
				newPassword: {
					type: 'string',
					example: 'NewStrongP@ssw0rd',
				},
			},
		},
	})
	async changePassword(
		@Req() req: Request,
		@Body() changePasswordDto: { currentPassword: string; newPassword: string },
	) {
		return this.authService.changePassword(
			req.user['id'],
			changePasswordDto.currentPassword,
			changePasswordDto.newPassword,
		);
	}

	@Get('google')
	@UseGuards(GoogleAuthGuard)
	@ApiOperation({ summary: 'Initiate Google OAuth flow' })
	@ApiResponse({ status: 302, description: 'Redirects to Google for authentication' })
	async googleAuth(@Req() req) {
		// Initiates the Google OAuth2 login flow handled by passport-google-oauth20
	}

	@Get('google-callback')
	@UseGuards(GoogleAuthGuard)
	@ApiOperation({ summary: 'Google OAuth2 callback' })
	@ApiExcludeEndpoint()
	async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
		const user = req.user as any;

		if (!user) {
			return res.redirect('/login/error');
		}

		const loginResult = await this.authService.loginWithGoogle(user);

		const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${loginResult.accessToken}&refreshToken=${loginResult.refreshToken}`;
		res.redirect(redirectUrl);
	}
}
