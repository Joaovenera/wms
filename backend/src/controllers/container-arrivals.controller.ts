import { Request, Response } from 'express';
import { db } from '../infrastructure/database/database.js';
import fs from 'fs';
import path from 'path';

interface ContainerArrival {
  id?: number;
  containerNumber: string;
  sealNumber: string;
  status: 'awaiting' | 'arrived' | 'documenting' | 'unloading' | 'completed';
  supplierName: string;
  estimatedArrival: string;
  actualArrival?: string;
  notes?: string;
  transporterName?: string;
  transporterContact?: string;
  vehicleInfo?: string;
  driverName?: string;
  driverDocument?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  completedAt?: string;
}

interface ContainerPhoto {
  id?: number;
  containerId: number;
  type: 'seal' | 'container_number' | 'first_opening' | 'clean_empty';
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt?: string;
}

interface ContainerItem {
  id?: number;
  containerId: number;
  productId: number;
  quantity: string;
  notes?: string;
  condition?: 'good' | 'damaged' | 'missing';
  createdAt?: string;
}

class ContainerArrivalsController {
  // GET /api/container-arrivals
  async getAllContainers(req: Request, res: Response) {
    try {
      const { status, search, limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT ca.*, 
               COUNT(DISTINCT cp.id) as photo_count,
               COUNT(DISTINCT ci.id) as item_count,
               COALESCE(SUM(CAST(ci.quantity AS DECIMAL)), 0) as total_quantity
        FROM container_arrivals ca
        LEFT JOIN container_photos cp ON ca.id = cp.container_id
        LEFT JOIN container_items ci ON ca.id = ci.container_id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (status) {
        query += ` AND ca.status = ?`;
        params.push(status);
      }
      
      if (search) {
        query += ` AND (ca.container_number LIKE ? OR ca.seal_number LIKE ? OR ca.supplier_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      
      query += `
        GROUP BY ca.id
        ORDER BY ca.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
      
      const containers = await db.query(query, params);
      
      res.json(containers);
    } catch (error) {
      console.error('Erro ao buscar containers:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // GET /api/container-arrivals/stats
  async getContainerStats(req: Request, res: Response) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'awaiting' THEN 1 ELSE 0 END) as awaiting,
          SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END) as arrived,
          SUM(CASE WHEN status = 'documenting' THEN 1 ELSE 0 END) as documenting,
          SUM(CASE WHEN status = 'unloading' THEN 1 ELSE 0 END) as unloading,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM container_arrivals
      `;
      
      const [stats] = await db.query(query);
      res.json(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // GET /api/container-arrivals/:id
  async getContainerById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Buscar container
      const [container] = await db.query(
        'SELECT * FROM container_arrivals WHERE id = ?', 
        [id]
      );
      
      if (!container) {
        return res.status(404).json({ message: 'Container não encontrado' });
      }
      
      // Buscar fotos
      const photos = await db.query(
        'SELECT * FROM container_photos WHERE container_id = ? ORDER BY created_at',
        [id]
      );
      
      // Buscar itens com informações do produto
      const items = await db.query(`
        SELECT ci.*, p.sku, p.name as product_name, p.unit
        FROM container_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.container_id = ?
        ORDER BY ci.created_at
      `, [id]);
      
      const result = {
        ...container,
        photos: photos.map(photo => ({
          ...photo,
          url: `/api/container-arrivals/${id}/photos/${photo.id}`
        })),
        items
      };
      
      res.json(result);
    } catch (error) {
      console.error('Erro ao buscar container:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // POST /api/container-arrivals
  async createContainer(req: Request, res: Response) {
    try {
      const containerData: ContainerArrival = req.body;
      const userId = (req as any).user?.id;
      const userName = (req as any).user?.name || 'Sistema';
      
      const query = `
        INSERT INTO container_arrivals (
          container_number, seal_number, status, supplier_name,
          estimated_arrival, actual_arrival, notes, transporter_name,
          transporter_contact, vehicle_info, driver_name, driver_document,
          created_by_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const params = [
        containerData.containerNumber,
        containerData.sealNumber,
        containerData.status || 'awaiting',
        containerData.supplierName,
        containerData.estimatedArrival,
        containerData.actualArrival || null,
        containerData.notes || null,
        containerData.transporterName || null,
        containerData.transporterContact || null,
        containerData.vehicleInfo || null,
        containerData.driverName || null,
        containerData.driverDocument || null,
        userId,
        userName
      ];
      
      const result = await db.query(query, params);
      const containerId = (result as any).insertId;
      
      // Processar fotos se fornecidas
      if (req.body.photos && Array.isArray(req.body.photos)) {
        for (const photo of req.body.photos) {
          await this.savePhotoFromBase64(containerId, photo);
        }
      }
      
      // Processar itens se fornecidos
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          await this.addItemToContainerInternal(containerId, item);
        }
      }
      
      res.status(201).json({ 
        id: containerId, 
        message: 'Container criado com sucesso' 
      });
      
    } catch (error) {
      console.error('Erro ao criar container:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // PUT /api/container-arrivals/:id
  async updateContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const query = `
        UPDATE container_arrivals 
        SET container_number = ?, seal_number = ?, supplier_name = ?,
            estimated_arrival = ?, actual_arrival = ?, notes = ?,
            transporter_name = ?, transporter_contact = ?, vehicle_info = ?,
            driver_name = ?, driver_document = ?, updated_at = NOW()
        WHERE id = ?
      `;
      
      const params = [
        updateData.containerNumber,
        updateData.sealNumber,
        updateData.supplierName,
        updateData.estimatedArrival,
        updateData.actualArrival || null,
        updateData.notes || null,
        updateData.transporterName || null,
        updateData.transporterContact || null,
        updateData.vehicleInfo || null,
        updateData.driverName || null,
        updateData.driverDocument || null,
        id
      ];
      
      await db.query(query, params);
      
      res.json({ message: 'Container atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar container:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // PUT /api/container-arrivals/:id/status
  async updateContainerStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const query = `
        UPDATE container_arrivals 
        SET status = ?, 
            ${status === 'completed' ? 'completed_at = NOW(),' : ''}
            updated_at = NOW()
        WHERE id = ?
      `;
      
      await db.query(query, [status, id]);
      
      res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // POST /api/container-arrivals/:id/photos
  async uploadPhoto(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { photoType } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }
      
      const photoData: ContainerPhoto = {
        containerId: parseInt(id),
        type: photoType,
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype
      };
      
      const query = `
        INSERT INTO container_photos (
          container_id, type, filename, original_name, file_path,
          file_size, mime_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      const params = [
        photoData.containerId,
        photoData.type,
        photoData.filename,
        photoData.originalName,
        photoData.filePath,
        photoData.fileSize,
        photoData.mimeType
      ];
      
      const result = await db.query(query, params);
      const photoId = (result as any).insertId;
      
      res.status(201).json({ 
        id: photoId,
        url: `/api/container-arrivals/${id}/photos/${photoId}`,
        message: 'Foto enviada com sucesso' 
      });
      
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // DELETE /api/container-arrivals/:id/photos/:photoId
  async deletePhoto(req: Request, res: Response) {
    try {
      const { id, photoId } = req.params;
      
      // Buscar arquivo
      const [photo] = await db.query(
        'SELECT file_path FROM container_photos WHERE id = ? AND container_id = ?',
        [photoId, id]
      );
      
      if (photo) {
        // Remover arquivo físico
        try {
          fs.unlinkSync(photo.file_path);
        } catch (err) {
          console.warn('Arquivo não encontrado:', photo.file_path);
        }
        
        // Remover do banco
        await db.query(
          'DELETE FROM container_photos WHERE id = ? AND container_id = ?',
          [photoId, id]
        );
      }
      
      res.json({ message: 'Foto removida com sucesso' });
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // GET /api/container-arrivals/:id/photos/:photoId
  async getPhoto(req: Request, res: Response) {
    try {
      const { id, photoId } = req.params;
      
      const [photo] = await db.query(
        'SELECT file_path, mime_type, original_name FROM container_photos WHERE id = ? AND container_id = ?',
        [photoId, id]
      );
      
      if (!photo || !fs.existsSync(photo.file_path)) {
        return res.status(404).json({ message: 'Foto não encontrada' });
      }
      
      res.setHeader('Content-Type', photo.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${photo.original_name}"`);
      res.sendFile(path.resolve(photo.file_path));
      
    } catch (error) {
      console.error('Erro ao buscar foto:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // POST /api/container-arrivals/:id/items
  async addItemToContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const itemData = req.body;
      
      await this.addItemToContainerInternal(parseInt(id), itemData);
      
      res.status(201).json({ message: 'Item adicionado com sucesso' });
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // Método interno para adicionar item
  private async addItemToContainerInternal(containerId: number, itemData: any) {
    const query = `
      INSERT INTO container_items (
        container_id, product_id, quantity, notes, condition, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    const params = [
      containerId,
      itemData.productId,
      itemData.quantity,
      itemData.notes || null,
      itemData.condition || 'good'
    ];
    
    return await db.query(query, params);
  }

  // PUT /api/container-arrivals/:id/items/:itemId
  async updateContainerItem(req: Request, res: Response) {
    try {
      const { id, itemId } = req.params;
      const updateData = req.body;
      
      const query = `
        UPDATE container_items 
        SET quantity = ?, notes = ?, condition = ?
        WHERE id = ? AND container_id = ?
      `;
      
      const params = [
        updateData.quantity,
        updateData.notes || null,
        updateData.condition || 'good',
        itemId,
        id
      ];
      
      await db.query(query, params);
      
      res.json({ message: 'Item atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // DELETE /api/container-arrivals/:id/items/:itemId
  async removeItemFromContainer(req: Request, res: Response) {
    try {
      const { id, itemId } = req.params;
      
      await db.query(
        'DELETE FROM container_items WHERE id = ? AND container_id = ?',
        [itemId, id]
      );
      
      res.json({ message: 'Item removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover item:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // POST /api/container-arrivals/:id/complete
  async completeContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Verificar se todas as fotos obrigatórias foram enviadas
      const photoCount = await db.query(
        'SELECT COUNT(*) as count FROM container_photos WHERE container_id = ?',
        [id]
      );
      
      if ((photoCount[0] as any).count < 4) {
        return res.status(400).json({ 
          message: 'Container não pode ser finalizado: faltam fotos obrigatórias' 
        });
      }
      
      // Atualizar status para completed
      await db.query(
        'UPDATE container_arrivals SET status = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?',
        ['completed', id]
      );
      
      res.json({ message: 'Container finalizado com sucesso' });
    } catch (error) {
      console.error('Erro ao finalizar container:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // GET /api/container-arrivals/:id/report
  async generateContainerReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Buscar dados completos do container
      const container = await this.getContainerById(req, res);
      
      // Por ora, retornar dados JSON
      // Futuramente, pode gerar PDF com as fotos
      res.json({
        container,
        generatedAt: new Date().toISOString(),
        type: 'container_arrival_report'
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // Método para salvar foto a partir de base64
  private async savePhotoFromBase64(containerId: number, photoData: any): Promise<void> {
    if (!photoData.url || !photoData.url.startsWith('data:')) return;
    
    const matches = photoData.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return;
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Definir extensão baseada no mime type
    const ext = mimeType === 'image/png' ? '.png' : 
               mimeType === 'image/webp' ? '.webp' : '.jpg';
    
    // Criar diretório
    const uploadDir = path.join(process.cwd(), 'uploads', 'containers', containerId.toString());
    fs.mkdirSync(uploadDir, { recursive: true });
    
    // Nome do arquivo
    const filename = `${containerId}_${photoData.type}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, filename);
    
    // Salvar arquivo
    fs.writeFileSync(filePath, buffer);
    
    // Salvar no banco
    const query = `
      INSERT INTO container_photos (
        container_id, type, filename, original_name, file_path,
        file_size, mime_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const params = [
      containerId,
      photoData.type,
      filename,
      photoData.filename || filename,
      filePath,
      buffer.length,
      mimeType
    ];
    
    await db.query(query, params);
  }
}

export const containerArrivalsController = new ContainerArrivalsController();