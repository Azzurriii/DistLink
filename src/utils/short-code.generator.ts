import { randomBytes } from 'crypto';

export class ShortCodeGenerator {
	// Extended alphabet with URL-friendly characters
	private static readonly alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789';

	// Code length
	private static readonly codeLength = 6;

	// Bit mask for faster modulo operation
	// Using 64 characters (alphabet.length) = 2^6
	private static readonly mask = 0x3f; // 63 in binary: 111111

	/**
	 * Generates a cryptographically strong random short code
	 * using bitwise operations for better performance
	 */
	static async generate(): Promise<string> {
		// Pre-allocate buffer for better performance
		const result = new Array(this.codeLength);
		const bytes = await randomBytes(this.codeLength);

		// Process bytes directly using bitwise operations
		for (let i = 0; i < this.codeLength; i++) {
			// Get the index of the character in the alphabet
			const index = bytes[i] & this.mask;
			result[i] = this.alphabet[index];
		}

		return result.join(''); // Join the array into a string
	}

	/**
	 * Generates a batch of unique short codes
	 * Optimized for batch processing
	 */
	static async generateBatch(size: number): Promise<string[]> {
		// Pre-allocate array for better performance
		const result = new Array(size);
		const generatedCodes = new Set<string>();

		// Generate codes in parallel for better performance
		const promises = Array(size)
			.fill(null)
			.map(async () => {
				let code: string;
				do {
					code = await this.generate();
				} while (generatedCodes.has(code));

				generatedCodes.add(code);
				return code;
			});

		return Promise.all(promises);
	}
}
