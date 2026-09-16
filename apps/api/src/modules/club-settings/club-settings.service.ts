import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClubSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isIanaTimeZone, UpdateClubSettingsDto } from './dto/club-settings.dto';

@Injectable()
export class ClubSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ClubSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.clubSettings.findUnique({ where: { id: 1 } });
    if (existing) {
      return;
    }

    const timezone = this.config.getOrThrow<string>('CLUB_TIMEZONE');
    if (!isIanaTimeZone(timezone)) {
      throw new Error(`CLUB_TIMEZONE is not a valid IANA time zone: ${timezone}`);
    }

    await this.prisma.clubSettings.create({
      data: {
        id: 1,
        name: this.config.getOrThrow<string>('CLUB_NAME'),
        timezone,
        weekStart: this.config.getOrThrow<number>('CLUB_WEEK_START'),
      },
    });
    this.logger.log(`Seeded club_settings timezone=${timezone}`);
  }

  async get(): Promise<ClubSettings> {
    const settings = await this.prisma.clubSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      throw new NotFoundException('Club settings are not initialized');
    }

    return settings;
  }

  async update(input: UpdateClubSettingsDto): Promise<ClubSettings> {
    await this.get();

    return this.prisma.clubSettings.update({
      where: { id: 1 },
      data: input,
    });
  }
}
