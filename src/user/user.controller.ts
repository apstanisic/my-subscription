import {
  Controller,
  Get,
  UseGuards,
  Put,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
  Delete,
  ForbiddenException,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './get-user.decorator';
import { User } from './user.entity';
import { UpdatePasswordData, LoginData } from '../auth/auth.dto';
import { UsersService } from './user.service';
import { UpdateUserInfo } from './update-user.dto';
import { ValidUUID } from '../core/uuid.pipe';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  /** Update user password */
  @Put('password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(@Body() data: UpdatePasswordData): Promise<User> {
    const { email, oldPassword, newPassword } = data;

    const user = await this.usersService.findForLogin(email, oldPassword);
    user.password = newPassword;
    return this.usersService.update(user);
  }

  /** Update user info */
  @Put()
  @UseGuards(AuthGuard('jwt'))
  async updateUserInfo(
    @Body() updateData: UpdateUserInfo,
    @GetUser() user: User,
  ): Promise<User> {
    return this.usersService.update(user, updateData);
  }

  /** Get logged user info */
  @Get('account')
  @UseGuards(AuthGuard('jwt'))
  getAccount(@GetUser() user: User) {
    return user;
  }

  /** Delete user */
  @Delete('account')
  @UseGuards(AuthGuard('jwt'))
  async deleteUser(
    @GetUser() loggedUser: User,
    @Body() { email, password }: LoginData,
  ) {
    const user = await this.usersService.findForLogin(email, password);
    if (user.id !== loggedUser.id) throw new ForbiddenException();
    return this.usersService.delete(user);
  }

  /** Get general user info by id */
  @Get('users/:id')
  GetUser(@Param('id', ValidUUID) id: string) {
    return this.usersService.findOne(id);
  }
}
