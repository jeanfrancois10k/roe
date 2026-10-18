import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { VendorSelfController } from './vendor-self.controller';

@Module({
  controllers: [VendorsController, VendorSelfController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
