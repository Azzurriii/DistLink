import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  SCYLLA_HOST: string;

  @IsNumber()
  SCYLLA_PORT: number;

  @IsString()
  SCYLLA_USERNAME: string;

  @IsString()
  SCYLLA_PASSWORD: string;

  @IsString()
  SCYLLA_KEYSPACE: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsString()
  KAFKA_BROKERS: string;

  @IsString()
  CLICKHOUSE_HOST: string;

  @IsNumber()
  CLICKHOUSE_PORT: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
