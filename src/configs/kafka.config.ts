import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  clientId: process.env.KAFKA_CLIENT_ID || 'distlink',
  groupId: process.env.KAFKA_GROUP_ID || 'distlink-group',
  topics: {
    urlClicks: 'url.clicks',
    urlAnalytics: 'url.analytics',
    urlErrors: 'url.errors',
  },
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
}));
