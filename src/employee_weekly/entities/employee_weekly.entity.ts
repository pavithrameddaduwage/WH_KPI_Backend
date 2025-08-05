import { BaseEntity } from 'src/common/base.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'hgusa_weekly' })
@Index('idx_hgusa_weekly_keys', ['startDate', 'endDate', 'payCode', 'businessUnitCode', 'homeDepartmentCode'])
export class EmployeeWeekly extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'pay_code', type: 'varchar', length: 255 })
  payCode: string;

  @Column({ name: 'business_unit_code', type: 'varchar', length: 255 })
  businessUnitCode: string;

  @Column({ name: 'home_department_code', type: 'varchar', length: 255 })
  homeDepartmentCode: string;

  @Column({ name: 'business_unit_description', type: 'varchar', length: 255, nullable: true })
  businessUnitDescription: string | null;

  @Column({ name: 'dollars', type: 'float', default: 0, nullable: true })
  dollars: number | null;

  @Column({ name: 'hours', type: 'float', default: 0, nullable: true })
  hours: number | null;

  @Column({ name: 'shift', type: 'varchar', length: 255, nullable: true })
  shift: string | null;
}
