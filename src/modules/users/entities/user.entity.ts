import { v4 as uuidv4 } from 'uuid';

export class User {
	id: string;
	fullName: string;
	email: string;
	password: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;
	isActive: boolean;
}
