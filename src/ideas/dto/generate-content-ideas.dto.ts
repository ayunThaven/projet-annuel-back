import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GenerateContentIdeasDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  theme: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @IsIn([3, 5, 10])
  count?: number;

  @IsOptional()
  @IsBoolean()
  checkDuplicates?: boolean;
}
