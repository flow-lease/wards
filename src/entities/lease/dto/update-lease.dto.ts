import { PartialType } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { CreateLeaseDto } from './create-lease.dto';

export class UpdateLeaseDto extends PartialType(CreateLeaseDto) {
  @IsString()
  id: string;
}
