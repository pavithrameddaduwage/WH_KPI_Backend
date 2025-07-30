import { Injectable } from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {User} from "./entities/user.entity";
import {EntityManager, ILike, Repository} from "typeorm";
import { HttpService } from '@nestjs/axios';


@Injectable()
export class UsersService {
  constructor(
      @InjectRepository(User)
      private readonly httpService: HttpService,
      private readonly entityManager: EntityManager,
  ) { }


    async login(email: string) {

        const user  =  await this.entityManager.findOne(User, {where: {email: email},});
        console.log(user)
        return user

    }

    findUserByEmail(username: string) {

        username=username.toLowerCase()

        return this.entityManager.findOne(User , { where: {username: ILike(username),},});
    }


}
