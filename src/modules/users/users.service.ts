import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
	constructor(private readonly databaseService: DatabaseService) {}

	async create(userData: { email: string; password: string; fullName: string }): Promise<User> {
		const client = this.databaseService.getClient();

		// Check if user already exists
		const existingUser = await client.execute('SELECT * FROM link_users WHERE email = ?', [userData.email], {
			prepare: true,
		});

		if (existingUser.rows.length > 0) {
			throw new ConflictException('User with this email already exists');
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(userData.password, 10);

		const userId = uuidv4();
		const now = new Date();

		// Create user with is_active = false
		await client.execute(
			`INSERT INTO link_users (
        id, email, password, full_name, created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[userId, userData.email, hashedPassword, userData.fullName, now, now, false],
			{ prepare: true },
		);

		return {
			id: userId,
			email: userData.email,
			fullName: userData.fullName,
			createdAt: now,
			updatedAt: now,
			isActive: false,
		} as User;
	}

	async findByEmail(email: string): Promise<User | null> {
		const client = this.databaseService.getClient();

		const result = await client.execute('SELECT * FROM link_users WHERE email = ?', [email], { prepare: true });

		if (result.rows.length === 0) {
			return null;
		}

		const user = result.first();
		return {
			id: user.id,
			email: user.email,
			password: user.password,
			fullName: user.full_name,
			createdAt: user.created_at,
			updatedAt: user.updated_at,
			deletedAt: user.deleted_at,
			isActive: user.is_active,
		} as User;
	}

	async findByGoogleId(googleId: string): Promise<User | null> {
		const client = this.databaseService.getClient();
		const result = await client.execute('SELECT * FROM link_users WHERE google_id = ?', [googleId], {
			prepare: true,
		});

		if (result.rows.length === 0) {
			return null;
		}

		const user = result.first();
		return {
			id: user.id,
			email: user.email,
			password: user.password,
			fullName: user.full_name,
			googleId: user.google_id,
			createdAt: user.created_at,
			updatedAt: user.updated_at,
			deletedAt: user.deleted_at,
			isActive: user.is_active,
		} as User;
	}

	async findById(id: string): Promise<User | null> {
		const client = this.databaseService.getClient();

		const result = await client.execute('SELECT * FROM link_users WHERE id = ?', [id], { prepare: true });

		if (result.rows.length === 0) {
			return null;
		}

		const user = result.first();
		return {
			id: user.id,
			email: user.email,
			password: user.password,
			fullName: user.full_name,
			googleId: user.google_id,
			createdAt: user.created_at,
			updatedAt: user.updated_at,
			deletedAt: user.deleted_at,
			isActive: user.is_active,
		} as User;
	}

	async updatePassword(userId: string, newPassword: string): Promise<boolean> {
		const client = this.databaseService.getClient();

		const hashedPassword = await bcrypt.hash(newPassword, 10);

		const currentPassword = await client.execute('SELECT password FROM link_users WHERE id = ?', [userId], {
			prepare: true,
		});

		if (!currentPassword.rows.length) {
			throw new NotFoundException('User not found');
		}

		if (currentPassword.rows[0].password === hashedPassword) {
			throw new BadRequestException('New password cannot be the same as the current password');
		}

		await client.execute(
			'UPDATE link_users SET password = ?, updated_at = ? WHERE id = ?',
			[hashedPassword, new Date(), userId],
			{ prepare: true },
		);

		return true;
	}

	async activateUser(userId: string): Promise<void> {
		const client = this.databaseService.getClient();

		await client.execute('UPDATE link_users SET is_active = true WHERE id = ?', [userId], { prepare: true });
	}

	async createFromGoogle(userData: Partial<CreateUserDto>): Promise<User> {
		const client = this.databaseService.getClient();
		const userId = uuidv4();
		const now = new Date();

		// Create user directly active, without password
		await client.execute(
			`INSERT INTO link_users (
        id, email, full_name, google_id, created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				userId,
				userData.email,
				userData.fullName,
				userData.googleId,
				now,
				now,
				true, // Directly active
			],
			{ prepare: true },
		);

		return {
			id: userId,
			email: userData.email,
			fullName: userData.fullName,
			googleId: userData.googleId,
			createdAt: now,
			updatedAt: now,
			isActive: true,
		} as User;
	}

	async linkGoogleId(userId: string, googleId: string): Promise<User> {
		const client = this.databaseService.getClient();
		const now = new Date();

		// Check if this googleId is already linked to another account
		const existingGoogleLink = await this.findByGoogleId(googleId);
		if (existingGoogleLink && existingGoogleLink.id !== userId) {
			throw new ConflictException('This Google account is already linked to another user.');
		}

		// Update the user record with the Google ID and potentially activate if not already
		await client.execute(
			'UPDATE link_users SET google_id = ?, updated_at = ?, is_active = true WHERE id = ?',
			[googleId, now, userId],
			{ prepare: true },
		);

		// Return the updated user information
		const updatedUser = await this.findById(userId);
		if (!updatedUser) {
			throw new NotFoundException('User not found after update');
		}
		return updatedUser;
	}

	async updateGoogleProfile(
		userId: string,
		profileData: { fullName: string /* Add picture if needed */ },
	): Promise<User> {
		const client = this.databaseService.getClient();
		const now = new Date();

		// Add other fields to update as necessary (e.g., picture)
		await client.execute(
			'UPDATE link_users SET full_name = ?, updated_at = ? WHERE id = ?',
			[profileData.fullName, now, userId],
			{ prepare: true },
		);

		const updatedUser = await this.findById(userId);
		if (!updatedUser) {
			throw new NotFoundException('User not found after profile update');
		}
		return updatedUser;
	}
}
