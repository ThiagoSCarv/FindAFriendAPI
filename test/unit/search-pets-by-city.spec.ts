import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { InMemoryPetsRepository } from '@/repositories/in-memory/in-memory-pets-repository';
import type { PetCreateInput } from '@/repositories/interfaces/IPetsRepository';
import { SearchPetsByCityUseCase } from '@/use-cases/search-pets-by-city';

describe('SearchPetsByCityUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let petsRepository: InMemoryPetsRepository;
  let sut: SearchPetsByCityUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    petsRepository = new InMemoryPetsRepository(orgsRepository);
    sut = new SearchPetsByCityUseCase(petsRepository);
  });

  async function createOrgInCity(city: string, email: string) {
    return orgsRepository.create({
      name: 'Adote',
      email,
      password_hash: 'hash',
      whatsapp: '+5511999999999',
      cep: '01310100',
      city,
      state: 'SP',
      address: 'Rua X',
    });
  }

  function petData(
    orgId: string,
    overrides: Partial<PetCreateInput> = {},
  ): PetCreateInput {
    return {
      name: 'Rex',
      about: 'Cão dócil',
      age: 'ADULT',
      size: 'MEDIUM',
      energy_level: 'MEDIUM',
      independence: 'MEDIUM',
      environment: 'MEDIUM',
      photos: [],
      requirements: [],
      org_id: orgId,
      ...overrides,
    };
  }

  it('should return only pets whose org is in the searched city', async () => {
    const spOrg = await createOrgInCity('São Paulo', 'sp@org.com');
    const rjOrg = await createOrgInCity('Rio de Janeiro', 'rj@org.com');

    await petsRepository.create(petData(spOrg.id, { name: 'Paulista' }));
    await petsRepository.create(petData(rjOrg.id, { name: 'Carioca' }));

    const { pets } = await sut.execute({ city: 'São Paulo', page: 1 });

    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Paulista');
  });

  it('should apply an optional filter (age)', async () => {
    const org = await createOrgInCity('São Paulo', 'sp@org.com');

    await petsRepository.create(petData(org.id, { name: 'Filhote', age: 'PUPPY' }));
    await petsRepository.create(petData(org.id, { name: 'Idoso', age: 'SENIOR' }));

    const { pets } = await sut.execute({ city: 'São Paulo', age: 'PUPPY', page: 1 });

    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Filhote');
  });

  it('should paginate results at 20 per page', async () => {
    const org = await createOrgInCity('São Paulo', 'sp@org.com');

    for (let i = 0; i < 22; i++) {
      await petsRepository.create(petData(org.id, { name: `Pet ${i}` }));
    }

    const page1 = await sut.execute({ city: 'São Paulo', page: 1 });
    const page2 = await sut.execute({ city: 'São Paulo', page: 2 });

    expect(page1.pets).toHaveLength(20);
    expect(page2.pets).toHaveLength(2);
  });
});
