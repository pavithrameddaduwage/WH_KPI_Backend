import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'diverse_weekly_reports' })
export class DiverseWeeklyReport {
  @PrimaryColumn({ name: 'employee_name' })
  employeeName: string;

  @PrimaryColumn({ name: 'report_start_date', type: 'date' })
  reportStartDate: Date;

  @PrimaryColumn({ name: 'report_end_date', type: 'date' })
  reportEndDate: Date;

  @Column({ name: 'employee_payroll_id' })
  employeePayrollId: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'department_name' })
  departmentName: string;

  @Column({ name: 'reg', type: 'float', default: 0 })
  reg: number;

  @Column({ name: 'ot1', type: 'float', default: 0 })
  ot1: number;

  @Column({ name: 'total', type: 'float', default: 0 })
  total: number;
}
