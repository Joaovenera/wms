import { Request, Response } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { logError, logInfo } from "../utils/logger";

const scryptAsync = promisify(scrypt);

export class UsersController {
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  async getUsers(req: Request, res: Response) {
    try {
      logInfo('Fetching all users', { userId: (req as any).user?.id });
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      logError("Error fetching users", error as Error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      logInfo('Fetching user by ID', { userId: (req as any).user?.id, targetUserId: id });
      
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      logError("Error fetching user", error as Error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const result = insertUserSchema.safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Hash the password
      const hashedPassword = await this.hashPassword(result.data.password);
      const userData = { ...result.data, password: hashedPassword };

      logInfo('Creating new user', { 
        userId: (req as any).user?.id, 
        newUserEmail: userData.email,
        newUserRole: userData.role 
      });
      
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      logError("Error creating user", error as Error);
      res.status(500).json({ message: "Failed to create user" });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = insertUserSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Check if email already exists for other users
      if (result.data.email) {
        const existingUser = await storage.getUserByEmail(result.data.email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      // Hash password if provided
      let userData = { ...result.data };
      if (userData.password) {
        userData.password = await this.hashPassword(userData.password);
      }

      logInfo('Updating user', { 
        userId: (req as any).user?.id, 
        targetUserId: id,
        updatedFields: Object.keys(userData)
      });

      const user = await storage.updateUser(id, userData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      logError("Error updating user", error as Error);
      res.status(500).json({ message: "Failed to update user" });
    }
  }

  async updateUserRole(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!role || !['operator', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Role inválido" });
      }

      logInfo('Updating user role', { 
        userId: (req as any).user?.id, 
        targetUserId: id,
        newRole: role
      });

      const user = await storage.updateUser(id, { role });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      logError("Error updating user role", error as Error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      logInfo('Deleting user', { 
        userId: (req as any).user?.id, 
        targetUserId: id
      });
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      logError("Error deleting user", error as Error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  }
}

export const usersController = new UsersController();
