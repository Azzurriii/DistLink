import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(
		private readonly configService: ConfigService,
		private readonly authService: AuthService,
	) {
		super({
			clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
			clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
			callbackURL: configService.get<string>('GOOGLE_REDIRECT_URI'),
			scope: ['email', 'profile'],
		});
	}

	async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
		const { name, emails, photos, id: googleId } = profile;
		const user = {
			email: emails[0].value,
			firstName: name?.givenName,
			lastName: name?.familyName,
			picture: photos?.[0]?.value,
			googleId,
			accessToken,
		};

		try {
			// Delegate user finding/creation to AuthService
			const validatedUser = await this.authService.validateGoogleUser(user);
			done(null, validatedUser);
		} catch (err) {
			done(err, false);
		}
	}
}
