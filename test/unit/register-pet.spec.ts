import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { InMemoryPetsRepository } from '@/repositories/in-memory/in-memory-pets-repository';
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error';
import { RegisterPetUseCase } from '@/use-cases/register-pet';

describe('RegisterPetUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let petsRepository: InMemoryPetsRepository;
  let sut: RegisterPetUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    petsRepository = new InMemoryPetsRepository(orgsRepository);
    sut = new RegisterPetUseCase(petsRepository, orgsRepository);
  });

  async function createOrg() {
    return orgsRepository.create({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password_hash: 'hash',
      whatsapp: '+5511999999999',
      cep: '01310100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Av. Paulista',
    });
  }

  it('should register a pet for an existing org', async () => {
    const org = await createOrg();

    const { pet } = await sut.execute({
      name: 'Rex',
      about: 'Cão dócil',
      age: 'PUPPY',
      size: 'MEDIUM',
      energy_level: 'HIGH',
      independence: 'LOW',
      environment: 'MEDIUM',
      photos: ['rex.jpg'],
      requirements: ['Espaço amplo'],
      org_id: org.id,
    });

    expect(pet.id).toEqual(expect.any(String));
    expect(pet.org_id).toBe(org.id);
  });

  it('should throw ResourceNotFoundError when the org does not exist', async () => {
    await expect(() =>
      sut.execute({
        name: 'Rex',
        about: 'Cão dócil',
        age: 'PUPPY',
        size: 'MEDIUM',
        energy_level: 'HIGH',
        independence: 'LOW',
        environment: 'MEDIUM',
        photos: ['rex.jpg'],
        requirements: ['Espaço amplo'],
        org_id: 'non-existing-org-id',
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
