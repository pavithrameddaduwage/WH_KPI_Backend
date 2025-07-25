import {
  Entity,
  Column,
  PrimaryColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'employee_weekly' })
@Index('idx_employee_weekly_dates', ['startDate', 'endDate'])
export class EmployeeWeekly {
  // ---------- Composite Primary Key (matches conflictColumns) ----------
  @PrimaryColumn({ name: 'start_date', type: 'date' })
  startDate: Date;

  @PrimaryColumn({ name: 'end_date', type: 'date' })
  endDate: Date;

  @PrimaryColumn({ name: 'legal_last_name', type: 'varchar', length: 255 })
  legalLastName: string;

  @PrimaryColumn({ name: 'legal_first_name', type: 'varchar', length: 255 })
  legalFirstName: string;

  @PrimaryColumn({ name: 'pay_code', type: 'varchar', length: 255 })
  payCode: string;

  @PrimaryColumn({ name: 'business_unit_code', type: 'varchar', length: 255 })
  businessUnitCode: string;

  @PrimaryColumn({ name: 'home_department_code', type: 'varchar', length: 255 })
  homeDepartmentCode: string;

  @Column({ name: 'business_unit_description', type: 'varchar', length: 255, nullable: true })
  businessUnitDescription: string | null;

  @Column({ name: 'dollars', type: 'float', default: 0, nullable: true })
  dollars: number | null;

  @Column({ name: 'hours', type: 'float', default: 0, nullable: true })
  hours: number | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ name: 'shift', type: 'varchar', length: 255, nullable: true })
  shift: string | null;
}
