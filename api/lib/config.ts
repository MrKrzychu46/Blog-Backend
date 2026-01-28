import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3100),
  supportedPostCount: 15,

  databaseUrl: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  baseUrl: process.env.BASE_URL ?? 'http://localhost:3100',
};
