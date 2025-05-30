import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { IndexerState } from '../../indexer/entities/indexer-state.entity';

import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpsertLeaseDto } from './dto/upsert-lease.dto';
import { Lease } from './lease.entity';

@Injectable()
export class LeaseService {
  constructor(
    @InjectRepository(Lease)
    private readonly repo: Repository<Lease>
  ) {}

  create(dto: CreateLeaseDto) {
    const lease = this.repo.create(dto);
    return this.repo.save(lease);
  }

  async createMany(dtos: CreateLeaseDto[], manager?: EntityManager): Promise<Lease[]> {
    const CHUNK_SIZE = 100;
    const repo = manager ? manager.getRepository(Lease) : this.repo;
    return await repo.manager.transaction(async (manager) => {
      const savedLeases: Lease[] = [];
      for (let i = 0; i < dtos.length; i += CHUNK_SIZE) {
        const chunk = dtos.slice(i, i + CHUNK_SIZE);
        const entities = manager.create(Lease, chunk);
        const batch = await manager.save(entities);
        savedLeases.push(...batch);
      }
      return savedLeases;
    });
  }

  findAll() {
    return this.repo.find();
  }

  /**
   * Bulk upsert leases: updates existing if id is provided, or creates new otherwise.
   * @param dtos - Array of lease DTOs
   * @param manager
   */
  async upsertMany(dtos: UpsertLeaseDto[], manager?: EntityManager): Promise<Lease[]> {
    const repo = manager ? manager.getRepository(Lease) : this.repo;
    return await repo.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Lease);
      const savedLeases: Lease[] = [];

      for (const dto of dtos) {
        const preloaded = await repository.preload(dto);
        const entity = preloaded ?? repository.create(dto);
        const saved = await repository.save(entity);
        savedLeases.push(saved);
      }

      return savedLeases;
    });
  }

  async deleteMany(
    where: { heightGte: number },
    manager?: EntityManager
  ): Promise<{
    leasesRemoved: number | null | undefined;
    cancelLeasesRemoved: number | null | undefined;
  }> {
    const repo = manager ? manager.getRepository(IndexerState) : this.repo;

    const leasesRemoved = (
      await repo
        .createQueryBuilder()
        .delete()
        .from(Lease)
        .where('height >= :height', { height: where.heightGte })
        .execute()
    ).affected;

    const cancelLeasesRemoved = (
      await repo
        .createQueryBuilder()
        .update(Lease)
        .set({
          cancelTxId: null,
          cancelHeight: null,
          cancelTimestamp: null,
        })
        .where('cancelHeight >= :cancelHeight', { cancelHeight: where.heightGte })
        .execute()
    ).affected;
    return { leasesRemoved, cancelLeasesRemoved };
  }
}
