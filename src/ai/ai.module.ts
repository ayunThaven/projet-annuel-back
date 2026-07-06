import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../users/user.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DemoAiProvider } from './providers/demo-ai.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [AiController],
  providers: [AiService, DemoAiProvider, GeminiProvider],
  exports: [AiService],
})
export class AiModule {}
