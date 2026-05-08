import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../utils/mongo-sanitizer';

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize route parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  }
}
