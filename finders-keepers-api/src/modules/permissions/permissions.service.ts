import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, PermissionKey } from './permission.constants';

export type PermissionMap = Record<PermissionKey, boolean>;
export type AllRolePermissions = Record<string, PermissionMap>;

@Injectable()
export class PermissionsService implements OnModuleInit {
  // In-memory cache so every request doesn't hit the DB
  private cache: AllRolePermissions | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Seed defaults on startup if table is empty */
  async onModuleInit() {
    const count = await this.prisma.rolePermission.count();
    if (count === 0) {
      await this.seedDefaults();
    }
    await this.loadCache();
  }

  private async seedDefaults() {
    const rows = Object.entries(DEFAULT_PERMISSIONS).flatMap(([role, perms]) =>
      Object.entries(perms).map(([permission, allowed]) => ({ role: role as AdminRole, permission, allowed })),
    );
    await this.prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }

  private async loadCache() {
    const rows = await this.prisma.rolePermission.findMany();
    const result: AllRolePermissions = {};
    for (const row of rows) {
      if (!result[row.role]) result[row.role] = {} as PermissionMap;
      result[row.role][row.permission as PermissionKey] = row.allowed;
    }
    this.cache = result;
  }

  async getAll(): Promise<AllRolePermissions> {
    if (!this.cache) await this.loadCache();
    return this.cache!;
  }

  async can(role: AdminRole, permission: PermissionKey): Promise<boolean> {
    if (role === AdminRole.SUPER_ADMIN) return true; // SUPER_ADMIN always has all perms
    const perms = (await this.getAll())[role];
    return perms?.[permission] ?? false;
  }

  async update(updates: { role: AdminRole; permission: PermissionKey; allowed: boolean }[]): Promise<AllRolePermissions> {
    // Upsert each permission
    await Promise.all(
      updates.map((u) =>
        this.prisma.rolePermission.upsert({
          where: { role_permission: { role: u.role, permission: u.permission } },
          create: { role: u.role, permission: u.permission, allowed: u.allowed },
          update: { allowed: u.allowed },
        }),
      ),
    );
    // Bust cache
    this.cache = null;
    return this.getAll();
  }

  getAllPermissionKeys() {
    return PERMISSION_KEYS;
  }
}
