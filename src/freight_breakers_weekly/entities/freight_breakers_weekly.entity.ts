import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'freight_breakers_weekly' })
export class FreightBreakersWeekly {
  @PrimaryColumn('date', { name: 'start_date' })
  'Start Date': Date;

  @PrimaryColumn('date', { name: 'end_date' })
  'End Date': Date;

  @PrimaryColumn('date', { name: 'date' })
  'Date': Date;

  @Column('varchar', { name: 'employee', nullable: true })
  'Employee': string;

  @Column('varchar', { name: 'job', nullable: true })
  'Job': string;

  @Column('varchar', { name: 'container', nullable: true })
  'Container': string;

  @Column('int', { name: 'qty', nullable: true })
  'QTY': number;

  @Column('int', { name: 'sku_count', nullable: true })
  'SKUCount': number;

  @Column('varchar', { name: 'door', nullable: true })
  'Door': string;

  @Column('varchar', { name: 'type', nullable: true })
  'Type': string;

  @Column('int', { name: 'units', nullable: true })
  'Units': number;

  @Column('float', { name: 'rate', nullable: true })
  'Rate': number;

  @Column('float', { name: 'amount', nullable: true })
  'Amount': number;
}
