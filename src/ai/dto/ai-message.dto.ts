import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { AiMessageRole } from '../providers/ai-provider.interface';

export class AiMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role: AiMessageRole;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  content: string;
}
