import { Test, TestingModule } from '@nestjs/testing';
import { UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

describe('UrlsController', () => {
	let controller: UrlsController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UrlsController],
			providers: [
				{
					provide: UrlsService,
					useValue: {
						create: jest.fn(),
						findAll: jest.fn(),
						findByShortCode: jest.fn(),
						remove: jest.fn(),
						update: jest.fn(),
					},
				},
				{
					provide: RedisService,
					useValue: {
						get: jest.fn(),
						set: jest.fn(),
						del: jest.fn(),
						incr: jest.fn(),
						expire: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn(),
					},
				},
				{
					provide: RateLimitGuard,
					useValue: {
						canActivate: jest.fn().mockReturnValue(true),
					},
				},
			],
		})
			.overrideGuard(RateLimitGuard)
			.useValue({ canActivate: jest.fn().mockReturnValue(true) })
			.compile();

		controller = module.get<UrlsController>(UrlsController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
