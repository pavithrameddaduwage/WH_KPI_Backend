import { BaseEntity } from 'src/common/base.entity';
import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert } from 'typeorm';

@Entity({ name: 'diverse_weekly_reports' })
export class DiverseWeeklyReport extends BaseEntity {

 @PrimaryGeneratedColumn('uuid')
    id?: string;

  @Column({ name: 'employee_payroll_id' })
  employeePayrollId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'employee_name', nullable: true })
  employeeName: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'department_name', nullable: true })
  departmentName: string;

  @Column({ name: 'reg', type: 'float', default: 0, nullable: true })
  reg: number;

  @Column({ name: 'ot1', type: 'float', default: 0, nullable: true })
  ot1: number;

  @Column({ name: 'total', type: 'float', default: 0, nullable: true })
  total: number;

  @Column({ name: 'bill_rate', type: 'float', default: 0, nullable: true })
  billRate: number;

  @BeforeInsert()
  setDefaults() {
    if (!this.employeePayrollId) {
      this.employeePayrollId = '0';
    }
  }
}
