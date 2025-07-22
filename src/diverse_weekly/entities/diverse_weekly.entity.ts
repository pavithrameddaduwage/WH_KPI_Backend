import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'diverse_weekly_reports' })
export class DiverseWeeklyReport {
  @PrimaryColumn({ name: 'employee_payroll_id' })
  employeePayrollId: string;

  @PrimaryColumn({ name: 'start_date', type: 'date' })
  startDate: Date;

  @PrimaryColumn({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'employee_name' })
  employeeName: string;

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
