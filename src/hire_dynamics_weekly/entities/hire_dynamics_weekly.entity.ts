import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'hire_dynamics_weekly' })
export class HireDynamicsWeekly {
  @PrimaryColumn({ name: 'start_date', type: 'date' })
  startDate: Date;

  @PrimaryColumn({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'department_g3' })
  departmentG3: string;

  @Column({ name: 'employee' })
  employee: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate: Date;

  @Column({ name: 'approval_status' })
  approvalStatus: string;

  @Column({ name: 'time_dcomp' })
  timeDcomp: string;

  @Column({ name: 'date', type: 'date' })
  date: Date;

  @Column({ name: 'paycode' })
  paycode: string;

  @Column({ name: 'in_time' })
  in: string;

  @Column({ name: 'in_ex' })
  inEx: string;

  @Column({ name: 'out_time' })
  out: string;

  @Column({ name: 'out_ex' })
  outEx: string;

  @Column({ name: 'reason' })
  reason: string;

  @Column({ name: 'department' })
  department: string;

  @Column({ name: 'shift_pay_ex' })
  shiftPayEx: string;

  @Column({ name: 'reg_hrs', type: 'float', default: 0 })
  regHrs: number;

  @Column({ name: 'ot', type: 'float', default: 0 })
  ot: number;

  @Column({ name: 'dt', type: 'float', default: 0 })
  dt: number;

  @Column({ name: 'daily_total', type: 'float', default: 0 })
  dailyTotal: number;

  @Column({ name: 'count', type: 'int', default: 0 })
  count: number;
}
