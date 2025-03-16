import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly redisService: RedisService,
		private readonly mailerService: MailerService,
	) {}

	async validateUser(email: string, password: string): Promise<any> {
		const user = await this.usersService.findByEmail(email);

		if (!user) {
			return null;
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);

		if (!isPasswordValid) {
			return null;
		}

		// Remove password from returned object
		const { password: _, ...result } = user;
		return result;
	}

	async login(email: string, password: string) {
		const user = await this.validateUser(email, password);

		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}

		if (!user.isActive) {
			throw new UnauthorizedException('Account is inactive');
		}

		const tokens = await this.generateTokens(user);
		await this.storeRefreshToken(user.id, tokens.refreshToken);

		return {
			user,
			...tokens,
		};
	}

	async register(userData: { email: string; password: string; fullName: string }) {
		const user = await this.usersService.create(userData);
		
		// Generate verification token
		const verificationToken = uuidv4();
		
		// Store token in Redis with expiration (24 hours)
		await this.redisService.set(
			`verification_token:${verificationToken}`,
			user.id,
			24 * 60 * 60, // 24 hours
		);
		
		// Send verification email
		const verificationLink = `${this.configService.get('BASE_URL')}/auth/verify-email/${verificationToken}`;
		
		// Send email with verification link
		await this.sendVerificationEmail(user.email, user.fullName, verificationLink);
		
		return {
			message: 'Registration successful. Please check your email to verify your account.',
			user: {
				id: user.id,
				email: user.email,
				fullName: user.fullName,
			},
		};
	}

	async verifyEmail(token: string) {
		// Get user ID from Redis
		const userId = await this.redisService.get(`verification_token:${token}`);
		
		if (!userId) {
			throw new BadRequestException('Invalid or expired verification token');
		}
		
		// Activate user account
		await this.usersService.activateUser(userId);
		
		// Delete token from Redis
		await this.redisService.del(`verification_token:${token}`);
		
		return {
			message: 'Email verified successfully. You can now log in.',
		};
	}

	async refreshToken(refreshToken: string) {
		// Verify refresh token
		try {
			const payload = this.jwtService.verify(refreshToken, {
				secret: this.configService.get('JWT_REFRESH_SECRET'),
			});

			// Check if token is in Redis
			const storedToken = await this.redisService.get(`refresh_token:${payload.sub}`);

			if (!storedToken || storedToken !== refreshToken) {
				throw new UnauthorizedException('Invalid refresh token');
			}

			const user = await this.usersService.findById(payload.sub);

			if (!user) {
				throw new UnauthorizedException('User not found');
			}

			// Generate new tokens
			const tokens = await this.generateTokens(user);

			// Update refresh token in Redis
			await this.storeRefreshToken(user.id, tokens.refreshToken);

			return tokens;
		} catch (error) {
			throw new UnauthorizedException('Invalid refresh token');
		}
	}

	async logout(userId: string) {
		// Remove refresh token from Redis
		await this.redisService.del(`refresh_token:${userId}`);

		return {
			message: 'Logged out successfully',
		};
	}

	async forgotPassword(email: string) {
		const user = await this.usersService.findByEmail(email);
		
		if (!user) {
			// Don't reveal that the user doesn't exist
			return {
				message: 'If your email is registered, you will receive a password reset link',
			};
		}
		
		// Generate reset token
		const resetToken = uuidv4();
		
		// Store token in Redis with expiration (1 hour)
		await this.redisService.set(
			`reset_token:${resetToken}`,
			user.id,
			3600, // 1 hour
		);
		
		// Create reset link
		const resetLink = `${this.configService.get('BASE_URL')}/auth/reset-password/${resetToken}`;
		
		// Send email with reset link
		await this.sendPasswordResetEmail(user.email, user.fullName, resetLink);
		
		return {
			message: 'If your email is registered, you will receive a password reset link',
		};
	}

	async resetPassword(token: string, newPassword: string) {
		// Get user ID from Redis
		const userId = await this.redisService.get(`reset_token:${token}`);

		if (!userId) {
			throw new BadRequestException('Invalid or expired reset token');
		}

		// Update password
		await this.usersService.updatePassword(userId, newPassword);

		// Delete token from Redis
		await this.redisService.del(`reset_token:${token}`);

		return {
			message: 'Password reset successful',
		};
	}

	private async generateTokens(user: any) {
		const payload = { sub: user.id, email: user.email };

		const accessToken = this.jwtService.sign(payload, {
			secret: this.configService.get('JWT_SECRET'),
			expiresIn: '15m', // Short-lived access token
		});

		const refreshToken = this.jwtService.sign(payload, {
			secret: this.configService.get('JWT_REFRESH_SECRET'),
			expiresIn: '7d', // Longer-lived refresh token
		});

		return {
			accessToken,
			refreshToken,
		};
	}

	private async storeRefreshToken(userId: string, token: string) {
		// Store refresh token in Redis with expiration (7 days)
		await this.redisService.set(
			`refresh_token:${userId}`,
			token,
			7 * 24 * 60 * 60, // 7 days
		);
	}

	private async sendVerificationEmail(email: string, name: string, verificationLink: string) {
		return this.mailerService.sendVerificationEmail(email, name, verificationLink);
	}

	private async sendPasswordResetEmail(email: string, name: string, resetLink: string) {
		return this.mailerService.sendPasswordResetEmail(email, name, resetLink);
	}

	async changePassword(userId: string, currentPassword: string, newPassword: string) {
		const user = await this.usersService.findById(userId);
		
		if (!user) {
			throw new UnauthorizedException('User not found');
		}
		
		const userWithPassword = await this.usersService.findByEmail(user.email);
		const isPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);
		
		if (!isPasswordValid) {
			throw new BadRequestException('Current password is incorrect');
		}
		
		await this.usersService.updatePassword(userId, newPassword);
		
		return {
			message: 'Password changed successfully',
		};
	}
}
