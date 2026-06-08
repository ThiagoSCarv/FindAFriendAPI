import { InMemoryCepProvider } from '@/providers/cep/in-memory-cep-provider';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { OrgAlreadyExistsError } from '@/use-cases/errors/org-already-exists-error';
import { RegisterOrgUseCase } from '@/use-cases/register-org';
import { compare } from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';

describe('RegisterOrgUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let cepProvider: InMemoryCepProvider;
  let sut: RegisterOrgUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    cepProvider = new InMemoryCepProvider();
    sut = new RegisterOrgUseCase(orgsRepository, cepProvider);
  });

  it('should create an org with address data from ViaCEP', async () => {
    cepProvider.addCep('01310100', {
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
    });

    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    });

    expect(org.city).toBe('São Paulo');
    expect(org.state).toBe('SP');
    expect(org.address).toBe('Avenida Paulista');
  });

  it('should accept org with empty address when CEP is not found', async () => {
    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '99999999',
    });

    expect(org.city).toBe('');
    expect(org.state).toBe('');
    expect(org.address).toBe('');
  });

  it('should let explicit body fields override ViaCEP data', async () => {
    cepProvider.addCep('01310100', {
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
    });

    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
      city: 'Campinas',
    });

    expect(org.city).toBe('Campinas');
    expect(org.state).toBe('SP');
  });

  it('should throw OrgAlreadyExistsError when email is already taken', async () => {
    await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    });

    await expect(() =>
      sut.execute({
        name: 'Adote SP 2',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '+5511999999999',
        cep: '01310100',
      }),
    ).rejects.toBeInstanceOf(OrgAlreadyExistsError);
  });

  it('should hash the password before storing', async () => {
    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    });

    const isHashed = await compare('123456', org.password_hash);
    expect(isHashed).toBe(true);
  });
});
