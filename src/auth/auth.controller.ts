import {
  Controller,
  Body,
  Post,
  BadRequestException,
  UseInterceptors,
  ClassSerializerInterceptor,
  Param,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToClass, classToClass } from 'class-transformer';
import { AuthService } from './auth.service';
import { UsersService } from '../user/user.service';
import { LoginData, SignInResponse, RegisterData } from './auth.dto';
import { User } from '../user/user.entity';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /** Attempt to login user */
  @Post('login')
  async login(@Body() { email, password }: LoginData): Promise<SignInResponse> {
    return this.authService.tryToLogin(email, password);
  }

  /** Register new user */
  /** @todo Add sending mail */
  @Post('register')
  async register(@Body() data: RegisterData) {
    try {
      const user = await this.usersService.create(data);
      const token = this.authService.createJwt(data.email);

      // For some reason user is not transformed without class to class
      return { token, user: classToClass(user) };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /* Confirm user account */
  @Put('confirm-account/:email/:token')
  async confirmAccout(
    @Param('email') email: string,
    @Param('token') token: string,
  ) {
    const user = await this.usersService.findOne({ email });
    if (user === undefined) throw new UnauthorizedException();
    if (user.secureToken !== token) throw new BadRequestException();
    user.confirmed = true;
    user.secureToken = undefined;
    user.tokenCreatedAt = undefined;
    await this.usersService.update(user);
    return plainToClass(User, user);
  }
}
