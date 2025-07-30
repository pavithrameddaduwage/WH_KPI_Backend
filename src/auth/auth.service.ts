import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import {HttpService} from "@nestjs/axios";
const ActiveDirectory = require('activedirectory2').promiseWrapper;


const config = {
  // url: 'ldaps://HGUWARDC01VM.Horizongroupusa.com',
  url: 'ldaps://HGUNBXDC01VM.Horizongroupusa.com',

  baseDN: 'dc=Horizongroupusa,dc=com',
  username: 'MISSVCACC',
  password: 'Horizon@MIS',
  attributes:{
    user:[]
  },
  tlsOptions:{
    rejectUnauthorized:false
  }
};
const ad = new ActiveDirectory(config);

@Injectable()
export class AuthService {
  constructor(
      private usersService: UsersService,
      private jwtService: JwtService,
      private readonly httpService: HttpService) {}


  async authenticateuser(username: string, password: string): Promise<boolean> {

    try {
      const authentication = await new Promise<boolean>((resolve, reject) => {
        ad.authenticate(username, password, (err: any, auth: boolean) => {
          if (err) {
            console.error('ERROR:', err);
            resolve(false);
          } else {
            resolve(auth);
          }
        });
      });


      return authentication;
    } catch (error) {
      console.error('Unexpected error:', error);
      return false;
    }
  }

  async getADUserDetails(username:string){
    let user =await new Promise((resolve, reject) => {
      ad.findUser(username, function(err: any, user: any) {
        if (err) {
          console.log('ERROR: ' +JSON.stringify(err));
          reject(err)
        }

        if (user){
          resolve(user)
          // resolve({"company":user.company,"co":user.co,"givenName":user.givenName,"displayName":user.displayName,"department":user.department,"email":user.mail,"location":user.physicalDeliveryOfficeName,"user_id":user.sAMAccountName,"thumbnailPhoto":user.thumbnailPhoto})
        }else{
          resolve('not_available')
        }
      });
    })

    return user
  }

  async signIn(username: string, password: string): Promise<any> {

    username = username.indexOf('@') > 0 ? username.slice(0, username.indexOf('@')) : username;
    username = username.toLowerCase();

    let adusername = username + '@hgusa.com';

    let adauthentication = await this.authenticateuser(adusername, password);

    if (!adauthentication) {
      adusername = username + '@horizongroupusa.com';
      adauthentication = await this.authenticateuser(adusername, password);
    }

    if (!adauthentication) {

      throw new UnauthorizedException('Invalid credentials');
    }


    const user = await this.usersService.findUserByEmail(username);


    if (!user) {

      throw new UnauthorizedException('User not authorized');
    }


    const payload = { email: user.email, name: user.username };


    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

}