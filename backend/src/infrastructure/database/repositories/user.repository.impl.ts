import { eq, desc, like, and, gte, lte, count, inArray } from 'drizzle-orm';
import { users } from '../schemas/auth.schema.js';
import { db } from '../database.js';
import { UserRepository, UserQueryFilters } from '../../../core/domain/interfaces/user.repository.js';
import { UserEntity, CreateUserData, UpdateUserData, UserProfile, User } from '../../../core/domain/entities/user.entity.js';
import { NotFoundError, ConflictError } from '../../../utils/exceptions/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class UserRepositoryImpl implements UserRepository {
  async findById(id: number): Promise<UserEntity | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user || null;
    } catch (error) {
      logError('Error finding user by ID', { error, id });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      return user || null;
    } catch (error) {
      logError('Error finding user by email', { error, email });
      throw error;
    }
  }

  async findAll(filters?: UserQueryFilters): Promise<UserEntity[]> {
    try {
      let query = db.select().from(users);

      // Apply filters
      if (filters) {
        const conditions = [];

        if (filters.email) {
          conditions.push(like(users.email, `%${filters.email}%`));
        }

        if (filters.role) {
          conditions.push(eq(users.role, filters.role));
        }

        if (filters.firstName) {
          conditions.push(like(users.firstName, `%${filters.firstName}%`));
        }

        if (filters.lastName) {
          conditions.push(like(users.lastName, `%${filters.lastName}%`));
        }

        if (filters.createdFrom) {
          conditions.push(gte(users.createdAt, filters.createdFrom));
        }

        if (filters.createdTo) {
          conditions.push(lte(users.createdAt, filters.createdTo));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const result = await query.orderBy(desc(users.createdAt));
      
      logInfo('Users retrieved successfully', { 
        count: result.length,
        filters: filters ? Object.keys(filters) : [],
      });

      return result;
    } catch (error) {
      logError('Error finding all users', { error, filters });
      throw error;
    }
  }

  async create(data: CreateUserData & { createdBy?: number }): Promise<UserEntity> {
    try {
      // Check if email already exists
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError(`User with email '${data.email}' already exists`);
      }

      const userData = User.create(data);
      const [newUser] = await db
        .insert(users)
        .values(userData)
        .returning();

      logInfo('User created successfully', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      return newUser;
    } catch (error) {
      logError('Error creating user', { error, email: data.email });
      throw error;
    }
  }

  async update(id: number, data: UpdateUserData): Promise<UserEntity | null> {
    try {
      const currentUser = await this.findById(id);
      if (!currentUser) {
        throw new NotFoundError('User', id);
      }

      // Check email uniqueness if email is being updated
      if (data.email && data.email !== currentUser.email) {
        const existingUser = await this.findByEmail(data.email);
        if (existingUser && existingUser.id !== id) {
          throw new ConflictError(`User with email '${data.email}' already exists`);
        }
      }

      const updateData = User.update(currentUser, data);
      
      if (Object.keys(updateData).length === 0) {
        return currentUser; // No changes needed
      }

      const [updatedUser] = await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      logInfo('User updated successfully', {
        userId: updatedUser.id,
        updatedFields: Object.keys(updateData),
      });

      return updatedUser;
    } catch (error) {
      logError('Error updating user', { error, id, updateData: Object.keys(data) });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(users)
        .where(eq(users.id, id));

      const deleted = (result.rowCount || 0) > 0;
      
      if (deleted) {
        logInfo('User deleted successfully', { userId: id });
      } else {
        logError('User not found for deletion', { userId: id });
      }

      return deleted;
    } catch (error) {
      logError('Error deleting user', { error, id });
      throw error;
    }
  }

  async getProfile(id: number): Promise<UserProfile | null> {
    try {
      const user = await this.findById(id);
      if (!user) {
        return null;
      }

      const userEntity = new User(user);
      return userEntity.toProfile();
    } catch (error) {
      logError('Error getting user profile', { error, id });
      throw error;
    }
  }

  async updateProfile(id: number, data: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const updateData: UpdateUserData = {};
      
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.email !== undefined) updateData.email = data.email;

      const updatedUser = await this.update(id, updateData);
      if (!updatedUser) {
        return null;
      }

      const userEntity = new User(updatedUser);
      return userEntity.toProfile();
    } catch (error) {
      logError('Error updating user profile', { error, id });
      throw error;
    }
  }

  async updatePassword(id: number, hashedPassword: string): Promise<boolean> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      const success = !!updatedUser;
      
      if (success) {
        logInfo('User password updated successfully', { userId: id });
      }

      return success;
    } catch (error) {
      logError('Error updating user password', { error, id });
      throw error;
    }
  }

  async updateRole(id: number, role: string): Promise<UserEntity | null> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (updatedUser) {
        logInfo('User role updated successfully', { userId: id, newRole: role });
      }

      return updatedUser || null;
    } catch (error) {
      logError('Error updating user role', { error, id, role });
      throw error;
    }
  }

  async findByRole(role: string): Promise<UserEntity[]> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.role, role))
        .orderBy(desc(users.createdAt));

      logInfo('Users found by role', { role, count: result.length });
      return result;
    } catch (error) {
      logError('Error finding users by role', { error, role });
      throw error;
    }
  }

  async existsByEmail(email: string): Promise<boolean> {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      return result.count > 0;
    } catch (error) {
      logError('Error checking if user exists by email', { error, email });
      throw error;
    }
  }

  async count(filters?: UserQueryFilters): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(users);

      if (filters) {
        const conditions = [];

        if (filters.email) {
          conditions.push(like(users.email, `%${filters.email}%`));
        }

        if (filters.role) {
          conditions.push(eq(users.role, filters.role));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const [result] = await query;
      return result.count;
    } catch (error) {
      logError('Error counting users', { error, filters });
      throw error;
    }
  }

  async createMany(usersData: (CreateUserData & { createdBy?: number })[]): Promise<UserEntity[]> {
    try {
      // Validate unique emails
      const emails = usersData.map(u => u.email.toLowerCase());
      const uniqueEmails = [...new Set(emails)];
      
      if (emails.length !== uniqueEmails.length) {
        throw new ConflictError('Duplicate emails found in batch');
      }

      // Check existing emails
      const existingUsers = await db
        .select()
        .from(users)
        .where(inArray(users.email, emails));

      if (existingUsers.length > 0) {
        const existingEmails = existingUsers.map(u => u.email);
        throw new ConflictError(`Users already exist with emails: ${existingEmails.join(', ')}`);
      }

      const userData = usersData.map(data => User.create(data));
      const newUsers = await db
        .insert(users)
        .values(userData)
        .returning();

      logInfo('Batch users created successfully', { count: newUsers.length });
      return newUsers;
    } catch (error) {
      logError('Error creating batch users', { error, count: usersData.length });
      throw error;
    }
  }

  async updateMany(updates: { id: number; data: UpdateUserData }[]): Promise<UserEntity[]> {
    try {
      const updatedUsers: UserEntity[] = [];

      // Process updates sequentially to maintain data integrity
      for (const update of updates) {
        const updatedUser = await this.update(update.id, update.data);
        if (updatedUser) {
          updatedUsers.push(updatedUser);
        }
      }

      logInfo('Batch users updated successfully', { 
        requested: updates.length,
        updated: updatedUsers.length,
      });

      return updatedUsers;
    } catch (error) {
      logError('Error updating batch users', { error, count: updates.length });
      throw error;
    }
  }

  async getCreatedUsers(createdBy: number): Promise<UserEntity[]> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.createdBy, createdBy))
        .orderBy(desc(users.createdAt));

      return result;
    } catch (error) {
      logError('Error getting users created by user', { error, createdBy });
      throw error;
    }
  }

  async getRecentlyCreated(days: number = 7): Promise<UserEntity[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      const result = await db
        .select()
        .from(users)
        .where(gte(users.createdAt, dateThreshold))
        .orderBy(desc(users.createdAt));

      return result;
    } catch (error) {
      logError('Error getting recently created users', { error, days });
      throw error;
    }
  }
}