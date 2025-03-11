import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('urls')
export class Url {
	@ApiProperty({ example: 'abc123', description: 'Short code for the URL' })
	@PrimaryColumn()
	shortCode: string;

	@ApiProperty({ example: 'https://example.com', description: 'Original URL' })
	@Column()
	originalUrl: string;

	@ApiProperty({ description: 'Creation timestamp' })
	@CreateDateColumn()
	createdAt: Date;

	@ApiProperty({ description: 'Expiration timestamp', required: false })
	@Column({ nullable: true })
	expiresAt?: Date;

	@ApiProperty({ description: 'Click count' })
	@Column({ default: 0 })
	clicks: number;
}
