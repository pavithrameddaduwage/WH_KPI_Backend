import {
    Entity,
    CreateDateColumn,
} from 'typeorm';

@Entity()
export abstract class BaseEntity {

    @CreateDateColumn()
    file_uploded_date?: Date;

}