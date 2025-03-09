import { Test, TestingModule } from '@nestjs/testing';
import { UrlsService } from './urls.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('UrlsService', () => {
  let service: UrlsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlsService,
        {
          provide: DatabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              execute: jest.fn().mockResolvedValue({ rows: [] }),
              batch: jest.fn().mockResolvedValue({})
            })
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation(key => {
              if (key === 'BASE_URL') return 'http://localhost:3000/';
              if (key === 'redis.keyPrefix') return 'test:';
              if (key === 'redis.ttl') return 3600;
              return null;
            })
          }
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<UrlsService>(UrlsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
