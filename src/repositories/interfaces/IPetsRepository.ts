import type {
  Age,
  EnergyLevel,
  Environment,
  Independence,
  Pet,
  Size,
} from '@prisma/client';

export type PetCreateInput = {
  name: string;
  about: string;
  age: Age;
  size: Size;
  energy_level: EnergyLevel;
  independence: Independence;
  environment: Environment;
  photos: string[];
  requirements: string[];
  org_id: string;
};

export type FindManyByCityParams = {
  city: string;
  age?: Age;
  size?: Size;
  energy_level?: EnergyLevel;
  independence?: Independence;
  environment?: Environment;
  page: number;
};

export interface IPetsRepository {
  create(data: PetCreateInput): Promise<Pet>;
  findById(id: string): Promise<Pet | null>;
  findManyByCity(params: FindManyByCityParams): Promise<Pet[]>;
}
