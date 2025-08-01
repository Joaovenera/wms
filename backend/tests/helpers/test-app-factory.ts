import express from 'express';
import { Server } from 'http';
import { registerRoutes } from '../../src/routes/index';
import logger from '../../src/utils/logger';

export class TestAppFactory {
  private app: express.Application | null = null;
  private server: Server | null = null;

  /**
   * Creates a test Express app with all routes and middleware configured
   */
  public async createApp(): Promise<express.Application> {
    if (this.app) {
      return this.app;
    }

    this.app = express();

    // Basic middleware for testing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: false, limit: '10mb' }));

    // Trust proxy for rate limiting tests
    this.app.set('trust proxy', 1);

    // Disable logging in tests unless explicitly enabled
    if (process.env.TEST_VERBOSE !== 'true') {
      logger.transports.forEach((transport) => {
        transport.silent = true;
      });
    }

    // Register all API routes
    this.server = await registerRoutes(this.app);

    // Global error handler for tests
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (process.env.TEST_VERBOSE === 'true') {
        console.error('Test app error:', err);
      }
      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'test' && { stack: err.stack })
      });
    });

    return this.app;
  }

  /**
   * Gets the current app instance
   */
  public getApp(): express.Application {
    if (!this.app) {
      throw new Error('App not created yet. Call createApp() first.');
    }
    return this.app;
  }

  /**
   * Gets the server instance for WebSocket testing
   */
  public getServer(): Server {
    if (!this.server) {
      throw new Error('Server not created yet. Call createApp() first.');
    }
    return this.server;
  }

  /**
   * Cleanup method for test teardown
   */
  public async cleanup(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          resolve();
        });
      });
    }
  }

  /**
   * Reset the factory state
   */
  public reset(): void {
    this.app = null;
    this.server = null;
  }
}

// Singleton instance for tests
export const testAppFactory = new TestAppFactory();