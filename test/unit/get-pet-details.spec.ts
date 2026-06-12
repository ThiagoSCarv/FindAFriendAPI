import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { InMemoryPetsRepository } from '@/repositories/in-memory/in-memory-pets-repository';
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error';
import { GetPetDetailsUseCase } from '@/use-cases/get-pet-details';

describe('GetPetDetailsUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let petsRepository: InMemoryPetsRepository;
  let sut: GetPetDetailsUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    petsRepository = new InMemoryPetsRepository(orgsRepository);
    sut = new GetPetDetailsUseCase(petsRepository);
  });

  it('should return the pet when it exists', async () => {
    const created = await petsRepository.create({
      name: 'Rex',
      about: 'Cão dócil',
      age: 'PUPPY',
      size: 'MEDIUM',
      energy_level: 'HIGH',
      independence: 'LOW',
      environment: 'MEDIUM',
      photos: ['rex.jpg'],
      requirements: ['Espaço amplo'],
      org_id: 'org-1',
    });

    const { pet } = await sut.execute({ petId: created.id });

    expect(pet.id).toBe(created.id);
    expect(pet.name).toBe('Rex');
  });

  it('should throw ResourceNotFoundError when the pet does not exist', async () => {
    await expect(() =>
      sut.execute({ petId: 'non-existing-pet-id' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
