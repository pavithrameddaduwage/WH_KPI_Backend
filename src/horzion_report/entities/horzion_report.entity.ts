import { BaseEntity } from 'src/common/base.entity';
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('horizon_reports')
export class HorizonReport extends BaseEntity {
  @PrimaryColumn({ type: 'date', name: 'uploaded_date' })
uploadedDate: Date;

@PrimaryColumn({ type: 'varchar', name: 'shift' })
shift: string;


  @Column('int', { name: 'total_scheduled', nullable: true })
  totalScheduled: number;

  @Column('int', { name: 'total_present', nullable: true })
  totalPresent: number;

  @Column('int', { name: 'late', nullable: true })
  late: number;

  @Column('int', { name: 'no_work', nullable: true })
  noWork: number;

  @Column('int', { name: 'no_call_no_show', nullable: true })
  noCallNoShow: number;

  @Column('int', { name: 'called_out', nullable: true })
  calledOut: number;

  @Column('int', { name: 'early_dismissal', nullable: true })
  earlyDismissal: number;

  @Column('int', { name: 'new_starters_today', nullable: true })
  newStartersToday: number;

  @Column('int', { name: 'terminations', nullable: true })
  terminations: number;

  @Column('int', { name: 'resignations', nullable: true })
  resignations: number;

  @Column('int', { name: 'inbound_scheduled', nullable: true })
  inboundScheduled: number;

  @Column('int', { name: 'inbound_completed', nullable: true })
  inboundCompleted: number;

  @Column('int', { name: 'total_cases_unloaded', nullable: true })
  totalCasesUnloaded: number;

  @Column('int', { name: 'total_cases_closed_for_the_day', nullable: true })
  totalCasesClosedForTheDay: number;

@Column('int', { name: 'total_containers_carried_over_to_the_next_day', nullable: true })
totalContainersCarriedOverToNextDay: number;


  @Column('float', { name: 'total_hours_for_the_day', nullable: true })
  totalHoursForTheDay: number;

  @Column('float', { name: 'cpm_for_the_day', nullable: true })
  cpmForTheDay: number;

  @Column('int', { name: 'number_of_skus', nullable: true })
  numberOfSkus: number;

  @Column('int', { name: 'near_misses', nullable: true })
  nearMisses: number;

  @Column('int', { name: 'incidents', nullable: true })
  incidents: number;

  @Column('int', { name: 'accidents', nullable: true })
  accidents: number;
}
