import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id:number

    //Todo
    @Column({unique: true,nullable:false })
    email:string

    @Column({nullable: true})
    username:string

    @Column({default:true})
    is_active:boolean

}
