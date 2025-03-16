import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	
	// Validation pipe
	app.useGlobalPipes(new ValidationPipe({
		whitelist: true,
		transform: true,
	}));
	
	// CORS
	app.enableCors();
	
	// Swagger
	const config = new DocumentBuilder()
		.setTitle('DistLink API')
		.setDescription('API documentation for DistLink URL shortener')
		.setVersion('1.0')
		.addBearerAuth()
		.build();
	
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document);
	
	const port = process.env.APP_PORT || 8000;
	await app.listen(port);
}
bootstrap();
