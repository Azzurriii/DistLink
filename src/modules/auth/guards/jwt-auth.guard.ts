import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	canActivate(context: ExecutionContext) {
		return super.canActivate(context);
	}

	handleRequest(err, user, info) {
		if (err || !user) {
			if (info && info.name === 'TokenExpiredError') {
				throw new UnauthorizedException('Token has expired');
			} else if (info && info.name === 'JsonWebTokenError') {
				throw new UnauthorizedException('Invalid token');
			}
			throw err || new UnauthorizedException('Invalid token or token expired');
		}
		return user;
	}
}
