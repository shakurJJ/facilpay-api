import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_keys')
@Index('idx_idempotency_key_value', ['key'], { unique: true })
@Index('idx_idempotency_key_expires_at', ['expiresAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'jsonb' })
  requestBody: Record<string, any>;

  @Column({ type: 'jsonb' })
  responseBody: Record<string, any>;

  @Column()
  responseStatus: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;
}
