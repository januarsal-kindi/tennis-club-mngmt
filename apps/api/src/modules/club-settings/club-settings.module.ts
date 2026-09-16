import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClubSettingsController } from './club-settings.controller';
import { ClubSettingsService } from './club-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [ClubSettingsController],
  providers: [ClubSettingsService],
})
export class ClubSettingsModule {}
