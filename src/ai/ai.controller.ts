import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AiService } from './ai.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { GenerateTextDto } from './dto/generate-text.dto';

/**
 * Authenticated endpoints exposing the generic AI foundation.
 */
@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('providers')
  listProviders() {
    return this.aiService.listProviders();
  }

  @Post('chat')
  complete(@Body() body: ChatCompletionDto) {
    return this.aiService.complete(body);
  }

  @Post('generate')
  generateText(@Body() body: GenerateTextDto) {
    return this.aiService.generateText(body);
  }
}
