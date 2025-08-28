import { BaseEntity } from 'src/common/base.entity';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'freight_breakers_weekly' })
export class FreightBreakersWeekly extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;  

  @Column('date', { name: 'start_date' })
  startDate: Date;

  @Column('date', { name: 'end_date' })
  endDate: Date;

  @Column('date', { name: 'date' })
  date: Date;

  @Column('varchar', { name: 'employee' })
  employee: string;

  @Column('varchar', { name: 'job' })
  job: string;

  @Column('varchar', { name: 'container', nullable: true })
  container: string;

  @Column('int', { name: 'qty' })
  qty: number;

  @Column('int', { name: 'sku_count' })
  skuCount: number;

  @Column('varchar', { name: 'door', nullable: true })
  door: string;

  @Column('varchar', { name: 'type' })
  type: string;

  @Column('int', { name: 'units' })
  units: number;

  @Column('float', { name: 'rate' })
  rate: number;

  @Column('float', { name: 'amount', nullable: true })
  amount: number | null;
 
}
