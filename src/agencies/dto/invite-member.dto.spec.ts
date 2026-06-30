import { validate } from 'class-validator';
import { AgencyRole } from '../../common/enums/agency-role.enum';
import { InviteMemberDto } from './invite-member.dto';

describe('InviteMemberDto', () => {
  it('accepts a valid agency invitation payload', async () => {
    const dto = Object.assign(new InviteMemberDto(), {
      agencyId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'editor@example.com',
      role: AgencyRole.EDITOR,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid agency id, email and role', async () => {
    const dto = Object.assign(new InviteMemberDto(), {
      agencyId: 'bad-id',
      email: 'bad-email',
      role: 'ADMIN',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['agencyId', 'email', 'role']),
    );
  });
});
