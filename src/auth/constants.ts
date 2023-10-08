export const jwtConstants = {
  // TODO: make it safe
  secret: process.env.JWT_SECRET || 'dev_JWT_SECRET_KEY',
};
