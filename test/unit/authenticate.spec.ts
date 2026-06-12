import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { AuthenticateUseCase } from '@/use-cases/authenticate';
import { InvalidCredentialsError } from '@/use-cases/errors/invalid-credentials-error';

describe('AuthenticateUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let sut: AuthenticateUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    sut = new AuthenticateUseCase(orgsRepository);
  });

  async function createOrg(email = 'adote@sp.com', password = '123456') {
    await orgsRepository.create({
      name: 'Adote SP',
      email,
      password_hash: await hash(password, 6),
      whatsapp: '+5511999999999',
      cep: '01310100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Av. Paulista',
    });
  }

  it('should authenticate with valid credentials', async () => {
    await createOrg();

    const { org } = await sut.execute({
      email: 'adote@sp.com',
      password: '123456',
    });

    expect(org.id).toEqual(expect.any(String));
    expect(org.role).toBe('ORG');
  });

  it('should not authenticate with a wrong password', async () => {
    await createOrg();

    await expect(() =>
      sut.execute({ email: 'adote@sp.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('should not authenticate with a non-existing email', async () => {
    await expect(() =>
      sut.execute({ email: 'nobody@sp.com', password: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
