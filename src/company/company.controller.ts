import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Body,
  Delete,
  Put,
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { PaginationParams } from '../core/pagination/pagination-options';
import { Company } from './company.entity';
import { User } from '../user/user.entity';
import { CompanyService } from './company.service';
import { GetPagination } from '../core/pagination/pagination.decorator';
import { GetUser } from '../user/get-user.decorator';
import { IfAllowed } from '../access-control/if-allowed.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { UpdateCompanyDto } from './company.dto';

/** Companies Controller */
@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompanyService) {}

  /** Get companies, filtered and paginated */
  @Get()
  find(@GetPagination() params: PaginationParams) {
    return this.service.paginate(params);
  }

  /** Get company by id */
  @Get(':id')
  findById(@Param('id') id: string): Promise<Company> {
    return this.service.findOne(id);
  }

  /** Create company */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() data: DeepPartial<Company>,
    @GetUser() user: User,
  ): Promise<Company> {
    return this.service.createCompany(data, user);
  }

  /** Remove company */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @IfAllowed()
  remove(@Param('id') id: string, @GetUser() user: User): Promise<Company> {
    return this.service.delete(id, user);
  }

  /** Update company */
  @Put(':id')
  @IfAllowed()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  async update(
    @Param('id') id: string,
    @Body() updateData: UpdateCompanyDto,
  ): Promise<Company> {
    return this.service.update(id, updateData);
  }
}
