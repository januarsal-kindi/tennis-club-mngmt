import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE } from './modules/auth/auth.constants';
import { HttpErrorFilter } from './shared/http-error.filter';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter());

  const config = new DocumentBuilder()
    .setTitle('Tennis Club API')
    .setDescription(
      'Phase 1 REST API — /api/v1. Auth uses an HttpOnly `tc_session` cookie ' +
        '(or `Authorization: Bearer <token>`).',
    )
    .setVersion('1')
    .addCookieAuth(SESSION_COOKIE)
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
