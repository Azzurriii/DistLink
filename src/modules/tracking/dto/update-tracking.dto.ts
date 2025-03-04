import { PartialType } from '@nestjs/mapped-types';
import { CreateTrackingDto } from './create-tracking.dto';

export class UpdateTrackingDto extends PartialType(CreateTrackingDto) {}
