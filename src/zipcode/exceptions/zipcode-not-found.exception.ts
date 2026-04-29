export class ZipcodeNotFoundException extends Error {
  readonly zipcode: string;

  constructor(zipcode: string, message: string) {
    super(message);
    this.name = 'ZipcodeNotFoundException';
    this.zipcode = zipcode;
  }
}
