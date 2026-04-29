import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZipcodeService } from './zipcode.service';
import { GetZipcodeDto } from './dto/get-zipcode.dto';
import { RequestContext } from '../common/request-context';

@Controller('cep')
export class ZipcodeController {
  constructor(private readonly zipcodeService: ZipcodeService) {}

  @Get(':zipcode')
  async searchZipcode(
    @Param() { zipcode }: GetZipcodeDto,
    @Query('lang') lang?: string,
  ): Promise<Record<string, string>> {
    const ctx = RequestContext.get();
    if (ctx && lang && ['pt', 'en'].includes(lang)) {
      ctx.language = lang;
    }

    const result = await this.zipcodeService.searchZipcode(zipcode);
    return {
      cep: result.zipcode,
      logradouro: result.street,
      bairro: result.neighborhood,
      cidade: result.city,
      estado: result.state,
    };
  }
}
