import { randomBytes } from 'crypto';

export class ShortCodeGenerator {
  // Extended alphabet with more characters for increased randomness
  private static readonly alphabet = 
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
  
  // Configurable code length (can be adjusted based on requirements)
  private static readonly codeLength = 8;
  
  // Prime number used for better distribution
  private static readonly prime = 61;

  /**
   * Generates a cryptographically strong random short code
   * with minimal collision probability
   */
  static async generate(): Promise<string> {
    const bytes = await randomBytes(this.codeLength);
    let result = '';
    
    for (let i = 0; i < this.codeLength; i++) {
      // Use modulo with prime number for better distribution
      const index = (bytes[i] * this.prime) % this.alphabet.length;
      result += this.alphabet[index];
    }
    
    return result;
  }

  /**
   * Generates a batch of unique short codes
   * Ensures no duplicates in the batch
   */
  static async generateBatch(size: number): Promise<string[]> {
    const generatedCodes = new Set<string>();
    
    while (generatedCodes.size < size) {
      const code = await this.generate();
      generatedCodes.add(code);
    }
    
    return Array.from(generatedCodes);
  }
}
