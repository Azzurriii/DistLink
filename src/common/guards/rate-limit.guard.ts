import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../modules/redis/redis.service';
import { ThrottlerException } from '@nestjs/throttler';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
	constructor(
		private readonly redisService: RedisService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const rateLimitOptions = this.reflector.getAllAndOverride(RATE_LIMIT_KEY, [
			context.getHandler(),
			context.getClass(),
		]) || { limit: 100, window: 3600 };

		const request = context.switchToHttp().getRequest();
		const ip = request.ip;
		const endpoint = request.route.path;
		const key = `ratelimit:${ip}:${endpoint}`;

		const current = await this.redisService.incr(key);
		if (current === 1) {
			await this.redisService.expire(key, rateLimitOptions.window);
		}

		if (current > rateLimitOptions.limit) {
			throw new ThrottlerException(
				`Too many requests. Try again in ${Math.ceil(rateLimitOptions.window / 60)} minutes`,
			);
		}

		return true;
	}
}
