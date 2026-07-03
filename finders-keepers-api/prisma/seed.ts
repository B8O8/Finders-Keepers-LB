import 'dotenv/config';
import { PrismaClient, AdminRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = 'admin@finderskeeperslb.com';
  const adminPassword = 'Admin@123456';

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      fullName: 'Finders Keepers Admin',
      role: AdminRole.SUPER_ADMIN,
    },
  });

  await prisma.storeSettings.upsert({
    where: { id: 'default-settings' },
    update: {},
    create: {
      id: 'default-settings',
      storeName: 'Finders Keepers LB',
      currency: 'USD',
      deliveryEnabled: true,
      defaultDeliveryFee: 3,
      freeDeliveryThreshold: 50,
      whatsappNumber: '+96170123456',
      orderMinimumAmount: 5,
      maintenanceMode: false,
    },
  });

  const women = await prisma.category.upsert({
    where: { slug: 'women' },
    update: {},
    create: {
      name: 'Women',
      slug: 'women',
      description: 'Premium women fashion collection',
      sortOrder: 1,
    },
  });

  const accessories = await prisma.category.upsert({
    where: { slug: 'accessories' },
    update: {},
    create: {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Elegant accessories and lifestyle pieces',
      sortOrder: 2,
    },
  });

  const dresses = await prisma.category.upsert({
    where: { slug: 'dresses' },
    update: {},
    create: {
      name: 'Dresses',
      slug: 'dresses',
      parentId: women.id,
      sortOrder: 1,
    },
  });

  const bags = await prisma.category.upsert({
    where: { slug: 'bags' },
    update: {},
    create: {
      name: 'Bags',
      slug: 'bags',
      parentId: accessories.id,
      sortOrder: 1,
    },
  });

  const logoFile = await prisma.fileAsset.upsert({
    where: { path: 'seed/logo.jpg' },
    update: {},
    create: {
      bucket: 'seed',
      path: 'seed/logo.jpg',
      url: 'https://placehold.co/800x1000/f8f6f1/111111?text=Finders+Keepers',
      fileName: 'logo.jpg',
      mimeType: 'image/jpeg',
      size: 1000,
      entity: 'Seed',
    },
  });

  const products = [
    {
      name: 'Elegant Satin Dress',
      slug: 'elegant-satin-dress',
      categoryId: dresses.id,
      shortDescription: 'A premium satin dress for special evenings.',
      price: 45,
      variants: [
        { name: 'Size S', sku: 'FK-DRESS-S', price: 45, stock: 12, isDefault: true },
        { name: 'Size M', sku: 'FK-DRESS-M', price: 45, stock: 8 },
        { name: 'Size L', sku: 'FK-DRESS-L', price: 48, stock: 5 },
      ],
    },
    {
      name: 'Classic Mini Bag',
      slug: 'classic-mini-bag',
      categoryId: bags.id,
      shortDescription: 'Compact premium everyday bag.',
      price: 35,
      variants: [
        { name: 'Black', sku: 'FK-BAG-BLK', price: 35, stock: 15, isDefault: true },
        { name: 'Beige', sku: 'FK-BAG-BGE', price: 35, stock: 10 },
      ],
    },
    {
      name: 'Gold Detail Bracelet',
      slug: 'gold-detail-bracelet',
      categoryId: accessories.id,
      shortDescription: 'Minimal bracelet with a premium gold finish.',
      price: 12,
      variants: [
        { name: 'Default', sku: 'FK-BRACELET-GOLD', price: 12, stock: 30, isDefault: true },
      ],
    },
  ];

  for (const item of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: item.slug },
    });

    if (existing) continue;

    await prisma.product.create({
      data: {
        name: item.name,
        slug: item.slug,
        shortDescription: item.shortDescription,
        description: item.shortDescription,
        categoryId: item.categoryId,
        isActive: true,
        isFeatured: true,
        images: {
          create: {
            fileId: logoFile.id,
            sortOrder: 0,
            isPrimary: true,
          },
        },
        variants: {
          create: item.variants.map((variant) => ({
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            stock: variant.stock,
            isDefault: variant.isDefault ?? false,
          })),
        },
      },
    });
  }

  console.log('Seed completed successfully');
  console.log(`Admin email: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });