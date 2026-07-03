import * as React from 'react';

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ResetPasswordEmailProps {
  resetUrl: string;
  customerName?: string;
}

export function ResetPasswordEmail({
  resetUrl,
  customerName,
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />

      <Preview>
        Reset your Finders Keepers password
      </Preview>

      <Body
        style={{
          backgroundColor: '#f6f9fc',
          fontFamily: 'Arial',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            margin: '40px auto',
            padding: '40px',
            borderRadius: '12px',
            maxWidth: '600px',
          }}
        >
          <Heading>
            Reset Your Password
          </Heading>

          <Text>
            Hello {customerName || 'Customer'},
          </Text>

          <Text>
            We received a request to reset your password.
          </Text>

          <Section
            style={{
              marginTop: '32px',
              marginBottom: '32px',
            }}
          >
            <Button
              href={resetUrl}
              style={{
                backgroundColor: '#000',
                color: '#fff',
                padding: '14px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              Reset Password
            </Button>
          </Section>

          <Text>
            If you did not request this,
            you can safely ignore this email.
          </Text>

          <Text>
            Finders Keepers LB
          </Text>
        </Container>
      </Body>
    </Html>
  );
}