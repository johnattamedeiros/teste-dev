import { Controller, Get } from '@nestjs/common';
import { PROVIDERS_CONFIG } from '../zipcode/providers.config';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  @Get()
  check() {
    return {
      status: 'ok',
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      providers: PROVIDERS_CONFIG.map((p) => p.name),
    };
  }
}
