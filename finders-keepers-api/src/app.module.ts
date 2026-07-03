import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminsModule } from './modules/admins/admins.module';
import { RolesModule } from './modules/roles/roles.module';
import { PosImportModule } from './modules/pos-import/pos-import.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { FilesModule } from './modules/files/files.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CustomerAuthModule } from './modules/customer-auth/customer-auth.module';
import { CustomerAddressesModule } from './modules/customer-addresses/customer-addresses.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductVariantsModule } from './modules/product-variants/product-variants.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MailModule } from './modules/mail/mail.module';
import { ProductReviewsModule } from './modules/product-reviews/product-reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    AdminsModule,
    RolesModule,
    ActivityLogsModule,
    PosImportModule,
    PermissionsModule,
    FilesModule,
    CustomersModule,
    AddressesModule,
    CustomerAuthModule,
    CustomerAddressesModule,
    SettingsModule,
    CategoriesModule,
    ProductsModule,
    ProductVariantsModule,
    StorefrontModule,
    CartModule,
    OrdersModule,
    DashboardModule,
    MailModule,
    ProductReviewsModule,
  ],
})
export class AppModule {}