import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { emptyToUndefined, toLowerCase, toOptionalInt } from '../../common/query.js';

export const CHARACTER_STATUSES = ['alive', 'dead', 'unknown'] as const;
export const CHARACTER_GENDERS = ['female', 'male', 'genderless', 'unknown'] as const;

export class ListCharactersDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @toOptionalInt()
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Filter by name (substring, case-insensitive)' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: CHARACTER_STATUSES })
  @emptyToUndefined()
  @toLowerCase()
  @IsOptional()
  @IsIn(CHARACTER_STATUSES)
  status?: (typeof CHARACTER_STATUSES)[number];

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  species?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ enum: CHARACTER_GENDERS })
  @emptyToUndefined()
  @toLowerCase()
  @IsOptional()
  @IsIn(CHARACTER_GENDERS)
  gender?: (typeof CHARACTER_GENDERS)[number];
}
