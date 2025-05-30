import { ApiProperty } from '@nestjs/swagger';

export class ConfigResponse {
  @ApiProperty({ required: false })
  profile?: string;
  @ApiProperty()
  logLevel: string;
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  nodeUrl: string;
  @ApiProperty()
  confirmationBlocks: number;
  @ApiProperty()
  validatorAddress: string;
  @ApiProperty()
  signerAddressFromPK: string | null;
  @ApiProperty()
  nodeOwnerBeneficiaryAddress: string;
  @ApiProperty()
  percentageToDistribute: number;
}
