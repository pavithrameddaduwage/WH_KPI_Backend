import { BaseEntity } from 'src/common/base.entity';
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('hire_dynamics_daily')
export class DailyReport extends BaseEntity  {
  @PrimaryColumn({ type: 'date', name: 'uploaded_date' })
  uploadedDate: Date;

  @PrimaryColumn({ name: 'employee' })
  employee: string;

  @Column({ type: 'date', name: 'date', nullable: true })
  date?: Date;

  @Column({ name: 'shift_g4', nullable: true, type: 'varchar' })
  shiftG4?: string;

  @Column({ name: 'department_g3', nullable: true, type: 'varchar' })
  departmentG3?: string;

  @Column('float', { name: 'reg_hrs', nullable: true })
  regHrs?: number;

  @Column('float', { name: 'reg_pay', nullable: true })
  regPay?: number;

  @Column('float', { name: 'reg_rate', nullable: true })
  regRate?: number;

  @Column('float', { name: 'ot', nullable: true })
  ot?: number;

  @Column('float', { name: 'ot_1_pay', nullable: true })
  ot1Pay?: number;

  @Column('float', { name: 'total_hrs', nullable: true })
  totalHrs?: number;

  @Column('float', { name: 'total_pay', nullable: true })
  totalPay?: number;
}
