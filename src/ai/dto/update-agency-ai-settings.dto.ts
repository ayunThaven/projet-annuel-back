import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAgencyAiSettingsDto {
  @IsOptional()
  @IsIn(['gemini', 'demo'])
  provider?: 'gemini' | 'demo';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  model?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  geminiApiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearGeminiApiKey?: boolean;
}
