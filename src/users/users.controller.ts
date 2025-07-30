import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {
  }


  @Post('login')
  findOne(@Body() data: { email: string }) {
    return this.usersService.login(data.email);
  }

    // @Post('create')
    // create(@Body() createUserDto: CreateUserDto) {
    //   console.log(createUserDto)
    //   return this.usersService.create(createUserDto);
    // }

    // @Delete(':id')
    // remove(@Param('id') id: string) {
    //   return this.usersService.remove(+id);
    // }

    // @Get('findAll')
    // findAll() {
    //   return this.usersService.findAll();
    // }

  }

