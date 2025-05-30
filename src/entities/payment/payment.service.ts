import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { IndexerState } from '../../indexer/entities/indexer-state.entity';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>
  ) {}

  async createMany(dtos: CreatePaymentDto[], manager?: EntityManager): Promise<Payment[]> {
    const CHUNK_SIZE = 100;
    const repo = manager ? manager.getRepository(Payment) : this.repo;
    return await repo.manager.transaction(async (manager) => {
      const savedPayments: Payment[] = [];
      for (let i = 0; i < dtos.length; i += CHUNK_SIZE) {
        const chunk = dtos.slice(i, i + CHUNK_SIZE);
        const entities = manager.create(Payment, chunk);
        const batch = await manager.save(entities);
        savedPayments.push(...batch);
      }
      return savedPayments;
    });
  }

  findAll(): Promise<Payment[]> {
    return this.repo.find();
  }

  async deleteMany(where: { heightGte: number }, manager?: EntityManager): Promise<number | null | undefined> {
    const repo = manager ? manager.getRepository(IndexerState) : this.repo;
    return (
      await repo
        .createQueryBuilder()
        .delete()
        .from(Payment)
        .where('height >= :height', { height: where.heightGte })
        .execute()
    ).affected;
  }
}
