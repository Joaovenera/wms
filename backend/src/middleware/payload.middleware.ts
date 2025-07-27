import express, { Request, Response, NextFunction } from 'express';

/**
 * High payload middleware for handling large file uploads (images)
 * Only to be used on specific routes that require large payload limits
 * 
 * Security: This middleware allows up to 150MB payloads to handle base64 encoded images
 * Should ONLY be applied to image upload endpoints to prevent DoS attacks
 */
export const highPayloadMiddleware = [
  express.json({ 
    limit: '150mb', // High limit for base64 image uploads (~133MB for 100MB images)
    strict: true,
    type: ['application/json', 'application/*+json']
  }),
  express.urlencoded({ 
    extended: false, 
    limit: '150mb', // Match JSON limit for consistency
    parameterLimit: 1000
  })
];

/**
 * Middleware to log when high payload limits are being used
 * Helps with monitoring and security auditing
 */
export const logHighPayloadUsage = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  const sizeInMB = (contentLength / 1024 / 1024).toFixed(2);
  
  // Only log if payload is actually large (> 1MB)
  if (contentLength > 1024 * 1024) {
    console.log(`📤 Large upload detected: ${req.method} ${req.path}`);
    console.log(`Content-Length: ${contentLength} bytes (${sizeInMB} MB)`);
  }
  next();
};

/**
 * Combined middleware for image uploads with logging
 */
export const imageUploadMiddleware = [
  logHighPayloadUsage,
  ...highPayloadMiddleware
];

/**
 * Middleware de validação de payload usando schema Zod
 */
import { ZodSchema } from 'zod';

export const validatePayload = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validar o body da requisição usando o schema fornecido
      const validatedData = schema.parse(req.body);
      
      // Substituir req.body pelos dados validados
      req.body = validatedData;
      
      next();
    } catch (error: any) {
      // Se for erro de validação do Zod
      if (error.errors) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      // Erro genérico
      return res.status(400).json({
        error: 'Erro na validação dos dados',
        message: error.message
      });
    }
  };
};