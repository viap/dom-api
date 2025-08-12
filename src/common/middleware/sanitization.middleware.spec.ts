import { Test } from '@nestjs/testing';
import { SanitizationMiddleware } from './sanitization.middleware';

describe('SanitizationMiddleware', () => {
  let middleware: SanitizationMiddleware;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SanitizationMiddleware],
    }).compile();

    middleware = module.get<SanitizationMiddleware>(SanitizationMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should sanitize request query parameters', () => {
    const mockNext = jest.fn();
    const mockReq = {
      query: {
        name: 'John',
        $where: 'malicious code',
        filter: { $ne: null },
      },
      body: {},
      params: {},
    };
    const mockRes = {};

    middleware.use(mockReq as any, mockRes as any, mockNext);

    expect(mockReq.query).toEqual({
      name: 'John',
      filter: {},
    });
    expect(mockReq.query.$where).toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should sanitize request body', () => {
    const mockNext = jest.fn();
    const mockReq = {
      query: {},
      body: {
        user: { name: 'John', $or: [{ admin: true }] },
        $regex: '.*',
      },
      params: {},
    };
    const mockRes = {};

    middleware.use(mockReq as any, mockRes as any, mockNext);

    expect(mockReq.body).toEqual({
      user: { name: 'John' },
    });
    expect(mockReq.body.$regex).toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should sanitize route parameters', () => {
    const mockNext = jest.fn();
    const mockReq = {
      query: {},
      body: {},
      params: {
        id: '507f1f77bcf86cd799439011',
        $where: 'malicious',
      },
    };
    const mockRes = {};

    middleware.use(mockReq as any, mockRes as any, mockNext);

    expect(mockReq.params).toEqual({
      id: '507f1f77bcf86cd799439011',
    });
    expect(mockReq.params.$where).toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle requests with no query/body/params', () => {
    const mockNext = jest.fn();
    const mockReq = {};
    const mockRes = {};

    expect(() => {
      middleware.use(mockReq as any, mockRes as any, mockNext);
    }).not.toThrow();

    expect(mockNext).toHaveBeenCalled();
  });
});
