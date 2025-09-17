import { BaseEntity } from 'src/common/base.entity';
import { Entity, PrimaryColumn } from 'typeorm';
 

@Entity('hgusa_employee_details')
export class HgusaEmployeeDetail   {
  @PrimaryColumn({ type: 'varchar', name: 'business_unit' })
  businessUnit: string;

  @PrimaryColumn({ type: 'varchar', name: 'full_name' })
  fullName: string;
}
