import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UsersService } from './user.service';
import { User } from './user.entity';
import { UserResolver } from './user.resolver';
import { Role } from '../access-control/roles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  controllers: [UserController],
  exports: [UsersService],
  providers: [UsersService, UserResolver],
})
export class UserModule {}
