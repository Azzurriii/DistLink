import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
	constructor(private readonly databaseService: DatabaseService) {}

	async create(userData: { email: string; password: string; fullName: string }): Promise<User> {
		const client = this.databaseService.getClient();

		// Check if user already exists
		const existingUser = await client.execute('SELECT * FROM users WHERE email = ?', [userData.email], {
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
			`INSERT INTO users (
        id, email, password, full_name, created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[userId, userData.email, hashedPassword, userData.fullName, now, now, false],
			{ prepare: true },
		);

		return {
			id: userId,
			email: userData.email,
			fullName: userData.fullName,
			password: undefined, // Don't return password
			createdAt: now,
			updatedAt: now,
			isActive: false,
		} as User;
	}

	async findByEmail(email: string): Promise<User | null> {
		const client = this.databaseService.getClient();

		const result = await client.execute('SELECT * FROM users WHERE email = ?', [email], { prepare: true });

		if (result.rows.length === 0) {
			return null;
		}

		const user = result.first();
		return {
			id: user.id,
			email: user.email,
			password: user.password, // Include password for auth service
			fullName: user.full_name,
			createdAt: user.created_at,
			updatedAt: user.updated_at,
			deletedAt: user.deleted_at,
			isActive: user.is_active,
		} as User;
	}

	async findById(id: string): Promise<User | null> {
		const client = this.databaseService.getClient();

		const result = await client.execute('SELECT * FROM users WHERE id = ?', [id], { prepare: true });

		if (result.rows.length === 0) {
			return null;
		}

		const user = result.first();
		return {
			id: user.id,
			email: user.email,
			password: undefined, // Don't include password
			fullName: user.full_name,
			createdAt: user.created_at,
			updatedAt: user.updated_at,
			deletedAt: user.deleted_at,
			isActive: user.is_active,
		} as User;
	}

	async updatePassword(userId: string, newPassword: string): Promise<boolean> {
		const client = this.databaseService.getClient();

		const hashedPassword = await bcrypt.hash(newPassword, 10);

		await client.execute(
			'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
			[hashedPassword, new Date(), userId],
			{ prepare: true },
		);

		return true;
	}

	async activateUser(userId: string): Promise<void> {
		const client = this.databaseService.getClient();

		await client.execute('UPDATE users SET is_active = true WHERE id = ?', [userId], { prepare: true });
	}
}
