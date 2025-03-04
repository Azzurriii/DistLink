import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.SCYLLA_HOST || 'localhost',
  port: parseInt(process.env.SCYLLA_PORT, 10) || 9042,
  username: process.env.SCYLLA_USERNAME || 'cassandra',
  password: process.env.SCYLLA_PASSWORD || 'cassandra',
  keyspace: process.env.SCYLLA_KEYSPACE || 'distlink',
  localDataCenter: 'datacenter1',
  consistencyLevel: 1,
  retryPolicy: {
    retries: 3,
    delay: 1000,
  },
}));
