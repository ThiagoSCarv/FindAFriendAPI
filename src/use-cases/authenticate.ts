import type { Org } from '@prisma/client';
import { compare } from 'bcryptjs';
import type { IOrgsRepository } from '../repositories/interfaces/IOrgsRepository.js';
import { InvalidCredentialsError } from './errors/invalid-credentials-error.js';

interface AuthenticateInput {
  email: string;
  password: string;
}

interface AuthenticateOutput {
  org: Org;
}

export class AuthenticateUseCase {
  constructor(private orgsRepository: IOrgsRepository) {}

  async execute({
    email,
    password,
  }: AuthenticateInput): Promise<AuthenticateOutput> {
    const org = await this.orgsRepository.findByEmail(email);

    if (!org) {
      throw new InvalidCredentialsError();
    }

    const doesPasswordMatch = await compare(password, org.password_hash);

    if (!doesPasswordMatch) {
      throw new InvalidCredentialsError();
    }

    return { org };
  }
}
