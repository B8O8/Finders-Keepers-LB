import { PartialType } from '@nestjs/swagger';

import { CreateDiscountDto } from './create-discount.dto';

/**
 * Targeting arrays behave as full replacements when supplied, and are left
 * untouched when omitted.
 */
export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {}
