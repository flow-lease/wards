import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { ConfigResponse } from './dto/config.response';
import { AppConfigService } from './app.config';

@Controller()
export class AppController {
  constructor(private readonly configService: AppConfigService) {}

  @Get('config')
  @ApiOkResponse({ type: ConfigResponse })
  getConfig(): ConfigResponse {
    return this.configService.getConfigResponse();
  }
}
