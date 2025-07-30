import {
    Entity,
    CreateDateColumn, Column,
} from 'typeorm';

@Entity()
export abstract class BaseEntity {

    @CreateDateColumn()
    file_uploded_date?: Date;

    @Column({ name: 'uploaded_by', type: 'varchar', nullable: true })
    uploaded_by?: string;

}