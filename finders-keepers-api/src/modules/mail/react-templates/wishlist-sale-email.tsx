import * as React from 'react';

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface WishlistSaleEmailProps {
  productName: string;
  variantName?: string | null;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  discountLabel?: string | null;
  productUrl: string;
  expiresAt?: string | null;
  customerName?: string;
  currency?: string;
}

function money(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

export function WishlistSaleEmail({
  productName,
  variantName,
  oldPrice,
  newPrice,
  discountPercent,
  discountLabel,
  productUrl,
  expiresAt,
  customerName,
  currency = 'USD',
}: WishlistSaleEmailProps) {
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Html>
      <Head />

      <Preview>{`${productName} is now ${discountPercent}% off`}</Preview>

      <Body style={{ backgroundColor: '#f8f6f1', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }}>
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '32px',
            }}
          >
            <Heading style={{ color: '#000000', fontSize: '24px', margin: '0 0 8px' }}>
              Good news{customerName ? `, ${customerName}` : ''} - it&apos;s on sale
            </Heading>

            <Text style={{ color: '#666666', fontSize: '15px', margin: '0 0 24px' }}>
              An item on your wishlist just dropped in price.
            </Text>

            <Text style={{ color: '#000000', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px' }}>
              {productName}
            </Text>

            {variantName ? (
              <Text style={{ color: '#666666', fontSize: '14px', margin: '0 0 16px' }}>
                {variantName}
              </Text>
            ) : null}

            <Section style={{ margin: '16px 0' }}>
              <Text style={{ margin: '0' }}>
                <span
                  style={{
                    color: '#999999',
                    fontSize: '16px',
                    textDecoration: 'line-through',
                    marginRight: '10px',
                  }}
                >
                  {money(oldPrice, currency)}
                </span>

                <span style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>
                  {money(newPrice, currency)}
                </span>
              </Text>

              <Text
                style={{
                  display: 'inline-block',
                  backgroundColor: '#d4af37',
                  color: '#000000',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  margin: '12px 0 0',
                }}
              >
                {discountLabel || `Save ${discountPercent}%`}
              </Text>
            </Section>

            <Button
              href={productUrl}
              style={{
                backgroundColor: '#000000',
                color: '#ffffff',
                padding: '14px 28px',
                borderRadius: '999px',
                fontSize: '15px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'inline-block',
                margin: '20px 0 0',
              }}
            >
              Shop now
            </Button>

            {expiry ? (
              <Text style={{ color: '#a33', fontSize: '13px', margin: '20px 0 0' }}>
                Offer ends {expiry}
              </Text>
            ) : null}

            <Hr style={{ borderColor: '#eeeeee', margin: '28px 0 16px' }} />

            <Text style={{ color: '#999999', fontSize: '12px', margin: '0' }}>
              You are receiving this because you added this item to your Finders
              Keepers wishlist.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
