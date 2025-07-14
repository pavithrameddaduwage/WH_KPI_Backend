import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'employee_reports' })
export class EmployeeReport {
  @PrimaryColumn({ name: 'uploaded_date', type: 'date' })
  uploadedDate: Date;

  @PrimaryColumn({ name: 'employee_name' })
  employeeName: string;

  @Column({ name: 'business_unit_description', nullable: true })
  businessUnitDescription: string;

  @Column({ name: 'business_unit_code', nullable: true })
  businessUnitCode: string;

  @Column({ name: 'home_department_code', nullable: true })
  homeDepartmentCode: string;

  @Column({ name: 'worked_department', nullable: true })
  workedDepartment: string;

  @Column({ name: 'pay_code_timecard', nullable: true })
  payCodeTimecard: string;

  @Column({ name: 'dollars', type: 'numeric', nullable: true })
  dollars: number;

  @Column({ name: 'hours', type: 'numeric', nullable: true })
  hours: number;

  @Column({ name: 'shift', nullable: true })
  shift: string;
}
