import { BaseEntity } from 'src/common/base.entity';
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'hire_dynamics_weekly' })
export class HireDynamicsWeekly extends BaseEntity {
  @PrimaryColumn('varchar', { name: 'employee_id' })
  'Employee': string;

  @PrimaryColumn('date', { name: 'start_date' })
  'Start Date': Date;

  @PrimaryColumn('date', { name: 'end_date' })
  'End Date': Date;

  @PrimaryColumn('date', { name: 'work_date' }) 
  'Work Date': Date;

  @Column('varchar', { name: 'department_g3', nullable: true })
  'Department  (G3)': string;

  @Column('varchar', { name: 'approval_status', nullable: true })
  'Approval Status': string;

  @Column('timestamp', { name: 'time_dcomp', nullable: true })
  'TIME.DCOMP': Date;

  @Column('date', { name: 'date', nullable: true })
  'Date': Date;

  @Column('varchar', { name: 'paycode', nullable: true })
  'Paycode': string;

  @Column('varchar', { name: 'in_time', nullable: true })
  'IN': string;

  @Column('varchar', { name: 'in_ex', nullable: true })
  'In Ex': string;

  @Column('varchar', { name: 'out_time', nullable: true })
  'OUT': string;

  @Column('varchar', { name: 'out_ex', nullable: true })
  'Out Ex': string;

  @Column('varchar', { name: 'reason', nullable: true })
  'Reason': string;

  @Column('varchar', { name: 'department', nullable: true })
  'Department': string;

  @Column('varchar', { name: 'shift_pay_ex', nullable: true })
  'Sh/Pay Ex': string;

  @Column('float', { name: 'reg_hrs', nullable: true })
  'Reg Hrs': number;

  @Column('float', { name: 'ot', nullable: true })
  'OT': number;

  @Column('float', { name: 'dt', nullable: true })
  'DT': number;

  @Column('float', { name: 'daily_total', nullable: true })
  'Daily Total': number;

  @Column('int', { name: 'count', nullable: true })
  'COUNT': number;
}
