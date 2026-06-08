export class OrgAlreadyExistsError extends Error {
  constructor() {
    super('Organization with this email already exists.');
    this.name = 'OrgAlreadyExistsError';
  }
}
