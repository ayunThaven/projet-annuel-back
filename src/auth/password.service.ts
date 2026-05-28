import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Encapsule le hash des mots de passe avec les primitives natives Node.
 *
 * Le format stocke l'algorithme, le sel et la cle derivee pour permettre une
 * verification sans conserver le mot de passe en clair.
 */
@Injectable()
export class PasswordService {
  /**
   * Retourne un hash persistable au format `scrypt$salt$key`.
   */
  hash(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');

    return `scrypt$${salt}$${derivedKey}`;
  }

  /**
   * Compare un mot de passe candidat avec le hash stocke en base.
   */
  verify(password: string, passwordHash: string): boolean {
    const [algorithm, salt, storedKey] = passwordHash.split('$');

    if (algorithm !== 'scrypt' || !salt || !storedKey) {
      return false;
    }

    const derivedKey = Buffer.from(
      scryptSync(password, salt, 64).toString('hex'),
      'hex',
    );
    const expectedKey = Buffer.from(storedKey, 'hex');

    return (
      derivedKey.length === expectedKey.length &&
      timingSafeEqual(derivedKey, expectedKey)
    );
  }
}
