import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { INVITE_ROLES } from '../team.service';

export class CreateTeamInviteDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn([...INVITE_ROLES])
  role?: string;

  /** 邀请留言。可选，写入邀请记录并随创建结果返回。 */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '邀请留言不能超过 500 字' })
  message?: string;
}

export class TeamInviteTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}
