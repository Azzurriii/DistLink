import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'User login' })
	@ApiResponse({ status: 200, description: 'Login successful' })
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
	@ApiResponse({ status: 201, description: 'Registration successful' })
	@ApiResponse({ status: 400, description: 'Bad request' })
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

	@Post('refresh-token')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Refresh access token' })
	@ApiResponse({ status: 200, description: 'Token refreshed successfully' })
	@ApiResponse({ status: 401, description: 'Invalid refresh token' })
	async refreshToken(@Body() body: { refreshToken: string }) {
		return this.authService.refreshToken(body.refreshToken);
	}

	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'User logout' })
	@ApiResponse({ status: 200, description: 'Logged out successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async logout(@Req() req: Request) {
		return this.authService.logout(req.user['id']);
	}

	@Post('forgot-password')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Request password reset' })
	@ApiResponse({ status: 200, description: 'Password reset email sent' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['email'],
			properties: {
				email: {
					type: 'string',
					example: 'user@example.com',
				},
			},
		},
	})
	async forgotPassword(@Body() body: { email: string }) {
		return this.authService.forgotPassword(body.email);
	}

	@Post('reset-password')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Reset password with token' })
	@ApiResponse({ status: 200, description: 'Password reset successful' })
	@ApiResponse({ status: 400, description: 'Invalid or expired token' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['token', 'password'],
			properties: {
				token: {
					type: 'string',
					example: '550e8400-e29b-41d4-a716-446655440000',
				},
				password: {
					type: 'string',
					example: 'NewStrongP@ssw0rd',
				},
			},
		},
	})
	async resetPassword(@Body() body: { token: string; password: string }) {
		return this.authService.resetPassword(body.token, body.password);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiOperation({ summary: 'Get current user profile' })
	@ApiResponse({ status: 200, description: 'User profile' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getProfile(@Req() req: Request) {
		return req.user;
	}

	@Get('verify-email/:token')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Verify email address with token' })
	@ApiResponse({ status: 200, description: 'Email verified successfully' })
	@ApiResponse({ status: 400, description: 'Invalid or expired token' })
	async verifyEmail(@Param('token') token: string) {
		return this.authService.verifyEmail(token);
	}
}
