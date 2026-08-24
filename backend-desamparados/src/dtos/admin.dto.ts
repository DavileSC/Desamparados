import { Role } from '@prisma/client';

export interface PromoteUserDto {
  userId: number;
  role: Role; 
}