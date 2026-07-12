import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

/**
 * Tous les champs sont optionnels : une mise a jour partielle est permise.
 * `null` explicite permet d'effacer un champ (ex: retirer la date).
 */
export class UpdateContentItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsDateString()
  publicationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  channel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contentType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string | null;
}