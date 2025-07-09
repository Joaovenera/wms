import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { z } from 'zod';

// Create a window object for DOMPurify
const window = new JSDOM('').window;
// @ts-ignore
const purify = DOMPurify(window);

// Sanitize HTML content
export const sanitizeHtml = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return purify.sanitize(input, { ALLOWED_TAGS: [] }); // Remove all HTML tags
};

// Sanitize and trim string
export const sanitizeString = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input).trim();
};

// Sanitize object with string properties
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized = { ...obj } as any;
  
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key]);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  });
  
  return sanitized as T;
};

// Enhanced validation schemas with sanitization
export const createSanitizedSchema = <T extends z.ZodRawShape>(shape: T) => {
  const sanitizedShape = Object.entries(shape).reduce((acc, [key, value]) => {
    if (value instanceof z.ZodString) {
      acc[key] = value.transform(sanitizeString);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
  
  return z.object(sanitizedShape);
};

// Common validation patterns
export const validationPatterns = {
  email: z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  code: z.string().min(1, 'Código é obrigatório').max(50, 'Código muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  positiveNumber: z.number().positive('Deve ser um número positivo'),
  nonNegativeNumber: z.number().min(0, 'Deve ser um número não negativo'),
};

// Rate limiting helper
export const createRateLimitMessage = (windowMs: number, max: number) => {
  const minutes = Math.floor(windowMs / 60000);
  return `Limite de ${max} requisições por ${minutes} minutos excedido`;
};

// Validate request body against schema
export const validateRequestBody = <T>(schema: z.ZodSchema<T>, data: any): T => {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    
    throw new ValidationError('Dados inválidos', errors);
  }
  
  return result.data;
};

// Custom error class for validation errors
export class ValidationError extends Error {
  public statusCode = 400;
  public errors: Array<{ field: string; message: string }>;
  
  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Middleware to handle validation errors
export const handleValidationError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      message: error.message,
      errors: error.errors,
    });
  }
  
  next(error);
}; 