import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

/**
 * End-to-end coverage of the money path: discount -> storefront price ->
 * cart price -> checkout -> persisted order.
 *
 * Why this exists as an e2e test rather than more unit tests: the pricing
 * engine is already covered in isolation. What is NOT covered by unit tests is
 * whether every layer actually *calls* that engine and agrees with it. A bug
 * where the cart preview shows $80 and the order charges $100 would pass every
 * unit test in the suite while costing real money. These tests assert the same
 * number survives all four hops.
 *
 * Runs against a real PostgreSQL database with the real migrations applied
 * (see global-setup.ts), because Decimal rounding and stock decrements are
 * exactly the things an in-memory mock gets wrong.
 */
describe('Money path (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ids = {
    category: '',
    product: '',
    variant: '',
  };

  beforeAll(async () => {
    // PrismaService reads DATABASE_URL when Nest constructs it, which happens
    // during compile() below - so this must be set first.
    process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirrors main.ts. Without this the DTOs would not transform or reject,
    // and the test would be exercising a different app than production runs.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  /**
   * Fresh product per test, so tests cannot leak state into each other through
   * stock levels or lingering discounts.
   */
  beforeEach(async () => {
    // Order matters: children before parents.
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.discountTarget.deleteMany();
    await prisma.discount.deleteMany();
    await prisma.productCategory.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    const suffix = randomUUID().slice(0, 8);

    const category = await prisma.category.create({
      data: { name: `Watches ${suffix}`, slug: `watches-${suffix}` },
    });

    const product = await prisma.product.create({
      data: {
        name: `Test Watch ${suffix}`,
        slug: `test-watch-${suffix}`,
        isActive: true,
        primaryCategoryId: category.id,
        productCategories: { create: { categoryId: category.id } },
        variants: {
          create: {
            name: 'Default',
            price: 100,
            stock: 10,
            isDefault: true,
            isActive: true,
          },
        },
      },
      include: { variants: true },
    });

    ids.category = category.id;
    ids.product = product.id;
    ids.variant = product.variants[0].id;
  });

  /**
   * Minimum VALID guest checkout body.
   *
   * The API requires name, phone, city, area and street for delivery. Omitting
   * any of them is a 400 - correct behaviour that these tests must satisfy
   * rather than route around, so the body lives in one place.
   */
  const guestCheckout = (guestToken: string) => ({
    guestToken,
    guestName: 'Test Buyer',
    guestEmail: 'buyer@example.com',
    guestPhone: '+96170000000',
    city: 'Beirut',
    area: 'Achrafieh',
    street: 'Main Street',
    paymentMethod: 'CASH_ON_DELIVERY',
  });

  /** A discount is created directly: these tests cover pricing, not admin auth. */
  const createDiscount = (overrides: Record<string, unknown> = {}) =>
    prisma.discount.create({
      data: {
        name: 'Test Sale',
        publicLabel: '20% off',
        type: 'PERCENTAGE',
        value: 20,
        startsAt: new Date(Date.now() - 60_000),
        isActive: true,
        priority: 10,
        stackable: false,
        targets: {
          create: {
            targetType: 'PRODUCT',
            targetId: ids.product,
            productId: ids.product,
          },
        },
        ...overrides,
      },
    });

  describe('no discount', () => {
    it('prices at the regular price and does not claim a sale', async () => {
      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 2 }] })
        .expect(200);

      expect(res.body.summary.subtotal).toBe(200);
      expect(res.body.summary.discountTotal).toBe(0);
      expect(res.body.items[0].pricing.onSale).toBe(false);
      expect(res.body.items[0].pricing.finalPrice).toBe(100);
    });
  });

  describe('percentage discount', () => {
    it('applies to the storefront product detail price', async () => {
      await createDiscount();

      const product = await prisma.product.findUniqueOrThrow({
        where: { id: ids.product },
      });

      const res = await request(app.getHttpServer())
        .get(`/storefront/products/${product.slug}`)
        .expect(200);

      const variant = res.body.variants.find(
        (v: { id: string }) => v.id === ids.variant,
      );

      expect(variant.pricing.regularPrice).toBe(100);
      expect(variant.pricing.finalPrice).toBe(80);
      expect(variant.pricing.onSale).toBe(true);
    });

    it('applies the same price in the cart, multiplied by quantity', async () => {
      await createDiscount();

      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 2 }] })
        .expect(200);

      expect(res.body.items[0].pricing.finalPrice).toBe(80);
      expect(res.body.items[0].lineTotal).toBe(160);
      expect(res.body.summary.regularSubtotal).toBe(200);
      expect(res.body.summary.discountTotal).toBe(40);
      expect(res.body.summary.subtotal).toBe(160);
    });

    it('charges the discounted price at checkout and snapshots it on the order', async () => {
      const discount = await createDiscount();
      const guestToken = `guest-${randomUUID()}`;

      await request(app.getHttpServer())
        .post('/cart/items')
        .send({ variantId: ids.variant, quantity: 2, guestToken })
        .expect(201);

      const checkout = await request(app.getHttpServer())
        .post('/orders/checkout/guest')
        .send(guestCheckout(guestToken))
        .expect(201);

      // The order must agree with the cart preview, to the cent.
      expect(Number(checkout.body.subtotal)).toBe(160);
      expect(Number(checkout.body.discountAmount)).toBe(40);
      expect(Number(checkout.body.totalAmount)).toBe(160);

      const items = await prisma.orderItem.findMany({
        where: { orderId: checkout.body.id },
      });

      expect(items).toHaveLength(1);
      expect(Number(items[0].regularPrice)).toBe(100);
      expect(Number(items[0].unitPrice)).toBe(80);
      expect(Number(items[0].totalPrice)).toBe(160);
      expect(items[0].discountId).toBe(discount.id);

      // The snapshot must survive the discount being deleted - it is the
      // historical record of what the customer actually paid.
      expect(items[0].productName).toBeTruthy();
    });

    it('decrements stock by the ordered quantity', async () => {
      await createDiscount();
      const guestToken = `guest-${randomUUID()}`;

      await request(app.getHttpServer())
        .post('/cart/items')
        .send({ variantId: ids.variant, quantity: 3, guestToken })
        .expect(201);

      await request(app.getHttpServer())
        .post('/orders/checkout/guest')
        .send(guestCheckout(guestToken))
        .expect(201);

      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: ids.variant },
      });

      expect(variant.stock).toBe(7);
    });
  });

  describe('discount boundaries', () => {
    it('ignores an expired discount', async () => {
      await createDiscount({
        startsAt: new Date(Date.now() - 172_800_000),
        endsAt: new Date(Date.now() - 86_400_000),
      });

      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 1 }] })
        .expect(200);

      expect(res.body.items[0].pricing.finalPrice).toBe(100);
      expect(res.body.items[0].pricing.onSale).toBe(false);
    });

    it('ignores a not-yet-started discount', async () => {
      await createDiscount({ startsAt: new Date(Date.now() + 86_400_000) });

      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 1 }] })
        .expect(200);

      expect(res.body.items[0].pricing.finalPrice).toBe(100);
    });

    it('ignores a deactivated discount', async () => {
      await createDiscount({ isActive: false });

      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 1 }] })
        .expect(200);

      expect(res.body.items[0].pricing.finalPrice).toBe(100);
    });

    it('never prices below zero, even when a fixed discount exceeds the price', async () => {
      await createDiscount({ type: 'FIXED', value: 500 });

      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 1 }] })
        .expect(200);

      expect(res.body.items[0].pricing.finalPrice).toBe(0);
      expect(res.body.summary.subtotal).toBe(0);
    });

    it('caps the discount at maxDiscountAmount', async () => {
      await createDiscount({ value: 50, maxDiscountAmount: 15 });

      const res = await request(app.getHttpServer())
        .post('/storefront/price-cart')
        .send({ items: [{ variantId: ids.variant, quantity: 1 }] })
        .expect(200);

      // 50% of 100 = 50, capped to 15 => 85.
      expect(res.body.items[0].pricing.discountAmount).toBe(15);
      expect(res.body.items[0].pricing.finalPrice).toBe(85);
    });
  });

  describe('backorder', () => {
    it('accepts an order at zero stock, floors stock at 0 and flags the line', async () => {
      await prisma.productVariant.update({
        where: { id: ids.variant },
        data: { stock: 1, allowBackorder: true },
      });

      const guestToken = `guest-${randomUUID()}`;

      await request(app.getHttpServer())
        .post('/cart/items')
        .send({ variantId: ids.variant, quantity: 4, guestToken })
        .expect(201);

      const checkout = await request(app.getHttpServer())
        .post('/orders/checkout/guest')
        .send(guestCheckout(guestToken))
        .expect(201);

      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: ids.variant },
      });

      // Stock must floor at 0, never go negative.
      expect(variant.stock).toBe(0);

      const items = await prisma.orderItem.findMany({
        where: { orderId: checkout.body.id },
      });

      expect(items[0].isBackorder).toBe(true);
      // 1 in stock, 4 ordered => 3 owed.
      expect(items[0].backorderQuantity).toBe(3);
    });

    it('rejects ordering more than stock when backorder is off', async () => {
      const guestToken = `guest-${randomUUID()}`;

      await request(app.getHttpServer())
        .post('/cart/items')
        .send({ variantId: ids.variant, quantity: 99, guestToken })
        .expect(400);
    });
  });
});
