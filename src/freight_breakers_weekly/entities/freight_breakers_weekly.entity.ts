import { BaseEntity } from 'src/common/base.entity';
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'freight_breakers_weekly' })
export class FreightBreakersWeekly extends BaseEntity  {
  @PrimaryColumn('date', { name: 'start_date' })
  StartDate: Date;

  @PrimaryColumn('date', { name: 'end_date' })
  EndDate: Date;

  @PrimaryColumn('date', { name: 'date' })
  Date: Date;

  @PrimaryColumn('varchar', { name: 'employee' })
  Employee: string;

  @PrimaryColumn('varchar', { name: 'job' })
  Job: string;

  @PrimaryColumn('varchar', { name: 'container' })
  Container: string;

  @PrimaryColumn('int', { name: 'qty' })
  QTY: number;

  @PrimaryColumn('int', { name: 'sku_count' })
  SKUCount: number;

  @PrimaryColumn('varchar', { name: 'door' })
  Door: string;

  @PrimaryColumn('varchar', { name: 'type' })
  Type: string;

  @PrimaryColumn('int', { name: 'units' })
  Units: number;

  @PrimaryColumn('float', { name: 'rate' })
  Rate: number;

  @Column('float', { name: 'amount', nullable: true })
  Amount: number | null;

 
}
