import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IdeaGenerationCadence } from '../enums/idea-generation-cadence.enum';

export class UpdateIdeaGenerationSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(IdeaGenerationCadence)
  cadence?: IdeaGenerationCadence;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeOfDay?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  theme?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string | null;

  @IsOptional()
  @IsIn([3, 5, 10])
  count?: number;

  @IsOptional()
  @IsBoolean()
  checkDuplicates?: boolean;
}
