import request from 'supertest';
import express from 'express';
import { Server } from 'http';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  role: string;
  token?: string;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: any;
}

export class ApiTestHelper {
  private app: express.Application | null = null;
  private server: Server | null = null;
  private baseUrl: string;

  constructor(app?: express.Application) {
    this.app = app || null;
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  }

  setApp(app: express.Application): void {
    this.app = app;
  }

  async startServer(port: number = 3001): Promise<void> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    return new Promise((resolve, reject) => {
      this.server = this.app!.listen(port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`✅ Test server started on port ${port}`);
          resolve();
        }
      });
    });
  }

  async stopServer(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('✅ Test server stopped');
          resolve();
        });
      });
    }
  }

  // Authentication helpers
  async loginUser(credentials: { username: string; password: string }): Promise<string> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const response = await request(this.app)
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);

    const token = response.headers['set-cookie']?.find((cookie: string) => 
      cookie.startsWith('sessionId=')
    );

    if (!token) {
      throw new Error('No authentication token received');
    }

    return token;
  }

  async createTestUser(userData: Partial<TestUser>): Promise<ApiResponse<TestUser>> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const response = await request(this.app)
      .post('/api/users')
      .send(userData);

    return {
      status: response.status,
      body: response.body,
      headers: response.headers
    };
  }

  // HTTP method helpers
  async get(path: string, token?: string): Promise<ApiResponse> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const req = request(this.app).get(path);
    
    if (token) {
      req.set('Cookie', token);
    }

    const response = await req;
    
    return {
      status: response.status,
      body: response.body,
      headers: response.headers
    };
  }

  async post(path: string, data?: any, token?: string): Promise<ApiResponse> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const req = request(this.app).post(path);
    
    if (token) {
      req.set('Cookie', token);
    }

    if (data) {
      req.send(data);
    }

    const response = await req;
    
    return {
      status: response.status,
      body: response.body,
      headers: response.headers
    };
  }

  async put(path: string, data?: any, token?: string): Promise<ApiResponse> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const req = request(this.app).put(path);
    
    if (token) {
      req.set('Cookie', token);
    }

    if (data) {
      req.send(data);
    }

    const response = await req;
    
    return {
      status: response.status,
      body: response.body,
      headers: response.headers
    };
  }

  async delete(path: string, token?: string): Promise<ApiResponse> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const req = request(this.app).delete(path);
    
    if (token) {
      req.set('Cookie', token);
    }

    const response = await req;
    
    return {
      status: response.status,
      body: response.body,
      headers: response.headers
    };
  }

  // File upload helper
  async uploadFile(path: string, fieldName: string, filePath: string, token?: string): Promise<ApiResponse> {
    if (!this.app) {
      throw new Error('Express app not provided');
    }

    const req = request(this.app)
      .post(path)
      .attach(fieldName, filePath);
    
    if (token) {
      req.set('Cookie', token);
    }

    const response = await req;
    
    return {
      status: response.status,
      body: response.body,
      headers: response.headers
    };
  }

  // Response validation helpers
  expectSuccess(response: ApiResponse, expectedStatus: number = 200): void {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toBeDefined();
  }

  expectError(response: ApiResponse, expectedStatus: number, expectedMessage?: string): void {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('error');
    
    if (expectedMessage) {
      expect(response.body.error).toContain(expectedMessage);
    }
  }

  expectValidationError(response: ApiResponse, field?: string): void {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('validation');
    
    if (field) {
      expect(response.body.validation).toHaveProperty(field);
    }
  }

  // JSON schema validation
  expectJsonSchema(data: any, schema: any): void {
    // Basic schema validation - could be extended with joi or ajv
    for (const [key, type] of Object.entries(schema)) {
      expect(data).toHaveProperty(key);
      expect(typeof data[key]).toBe(type);
    }
  }
}