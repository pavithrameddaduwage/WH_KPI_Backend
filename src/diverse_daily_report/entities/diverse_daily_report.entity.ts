import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'diverse_staffing_daily' })
export class DiverseDailyReport extends BaseEntity {
  @PrimaryColumn({ name: 'uploaded_date', type: 'date' })
  uploadedDate: Date;

  @PrimaryColumn({ name: 'employee_payroll_id' })
  employeePayrollId: string;

  @Column({ name: 'employee_name' })
  employeeName: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'pay_rate', type: 'float', default: 0 })
  payRate: number;

  @Column({ name: 'bill_rate', type: 'float', default: 0 })
  billRate: number;

  @Column({ name: 'department_name' })
  departmentName: string;

  @Column({ name: 'reg', type: 'float', default: 0 })
  reg: number;

  @Column({ name: 'ot1', type: 'float', default: 0 })
  ot1: number;

  @Column({ name: 'ot2', type: 'float', default: 0 })
  ot2: number;

  @Column({ name: 'vac', type: 'float', default: 0 })
  vac: number;

  @Column({ name: 'hol', type: 'float', default: 0 })
  hol: number;

  @Column({ name: 'sic', type: 'float', default: 0 })
  sic: number;

  @Column({ name: 'oth', type: 'float', default: 0 })
  oth: number;

  @Column({ name: 'total', type: 'float', default: 0 })
  total: number;

  @Column({ type: 'date', nullable: true })
  date: Date | null;

  @Column({ name: 'usd_cost', type: 'float', default: 0 })
  usdCost: number;
}
