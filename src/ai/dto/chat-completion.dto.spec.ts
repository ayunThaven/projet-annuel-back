import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatCompletionDto } from './chat-completion.dto';

describe('ChatCompletionDto', () => {
  it('accepts valid chat messages', async () => {
    const dto = plainToInstance(ChatCompletionDto, {
      messages: [{ role: 'user', content: 'Bonjour' }],
      context: 'Marque: SEO Genius. Cible: dirigeants de PME.',
      temperature: 0.7,
      maxTokens: 500,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid roles', async () => {
    const dto = plainToInstance(ChatCompletionDto, {
      messages: [{ role: 'tool', content: 'Bonjour' }],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].children?.[0].children?.[0].constraints).toHaveProperty(
      'isIn',
    );
  });
});
