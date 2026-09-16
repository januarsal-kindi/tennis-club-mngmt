import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class PublicUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'member@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ada Member' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.member })
  role!: Role;

  @ApiProperty({ example: '2026-09-16T00:00:00.000Z' })
  createdAt!: Date;
}
