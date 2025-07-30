import {Controller,Post, Body, HttpCode, HttpStatus} from '@nestjs/common';
import { AuthService } from './auth.service';
import {SignInDto} from "./dto/signin.dto";

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  // @Public()
  @Post('login')
  signIn(@Body() SignInDto: Record<string, any>) {
    return this.authService.signIn(SignInDto.email, SignInDto.password);
  }


}
