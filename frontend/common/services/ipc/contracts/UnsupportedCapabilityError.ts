export class UnsupportedCapabilityError extends Error {
  readonly code = 'UNSUPPORTED_CAPABILITY';

  constructor(readonly capability: string) {
    super(`This environment does not support ${capability}.`);
    this.name = 'UnsupportedCapabilityError';
  }
}
