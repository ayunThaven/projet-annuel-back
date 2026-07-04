import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurationStatus } from '../../common/enums/curation-status.enum';

/** Mise a jour partielle ; `null` explicite efface un champ. */
export class UpdateCurationItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[] | null;

  @IsOptional()
  @IsEnum(CurationStatus)
  status?: CurationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  curatedBy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
