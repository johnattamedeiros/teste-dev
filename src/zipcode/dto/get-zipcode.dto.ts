import { IsString, Matches } from 'class-validator';

export class GetZipcodeDto {
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, {
    message: 'CEP deve estar no formato 12345-678 ou 12345678',
  })
  zipcode: string;
}
