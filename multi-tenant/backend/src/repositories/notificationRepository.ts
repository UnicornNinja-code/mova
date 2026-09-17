/*
 * notificationRepository.ts
 * Data Access Layer for User In-App Notifications in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
  updated_at?: Date;
}

export class NotificationRepository {
  private static instance: NotificationRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (NotificationRepository.instance && dbPool === pool) {
      return NotificationRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      NotificationRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): NotificationRepository {
    if (!NotificationRepository.instance) {
      NotificationRepository.instance = new NotificationRepository(dbPool);
    }
    return NotificationRepository.instance;
  }

  public async getNotificationsByUserId(userId: string, limit: number = 30): Promise<NotificationItem[]> {
    const query = `
      SELECT id, user_id, title, message, is_read, created_at, updated_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const { rows } = await this.pool.query(query, [userId, limit]);
    return rows;
  }

  public async createNotification(data: {
    user_id: string;
    title: string;
    message: string;
  }): Promise<NotificationItem> {
    const query = `
      INSERT INTO notifications (user_id, title, message, is_read)
      VALUES ($1, $2, $3, false)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [data.user_id, data.title, data.message]);
    return rows[0];
  }

  public async markAsRead(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications
      SET is_read = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2;
    `;
    const { rowCount } = await this.pool.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  public async markAllAsRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications
      SET is_read = true, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false;
    `;
    const { rowCount } = await this.pool.query(query, [userId]);
    return rowCount ?? 0;
  }

  public async deleteNotification(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2;
    `;
    const { rowCount } = await this.pool.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }
}

export const notificationRepository = NotificationRepository.getInstance();
