import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('accepts a valid registration payload', async () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'owner@example.com',
      password: 'password123',
      displayName: 'Owner',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid email and short password', async () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'not-an-email',
      password: 'short',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });
});
