import {
    Entity,
    CreateDateColumn,
} from 'typeorm';

@Entity()
export abstract class BaseEntity {

    @CreateDateColumn()
    uploded_date?: Date;

}