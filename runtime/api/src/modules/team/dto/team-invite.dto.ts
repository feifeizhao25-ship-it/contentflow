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
}

export class TeamInviteTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}
