import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { IndexerState } from '../../indexer/entities/indexer-state.entity';

import { CreateBlockDto } from './dto/create-block.dto';
import { Block } from './block.entity';

@Injectable()
export class BlockService {
  constructor(
    @InjectRepository(Block)
    private readonly repo: Repository<Block>
  ) {}

  async createMany(dtos: CreateBlockDto[], manager?: EntityManager): Promise<Block[]> {
    const CHUNK_SIZE = 100;
    const repo = manager ? manager.getRepository(Block) : this.repo;
    return await repo.manager.transaction(async (manager) => {
      const savedBlocks: Block[] = [];
      for (let i = 0; i < dtos.length; i += CHUNK_SIZE) {
        const chunk = dtos.slice(i, i + CHUNK_SIZE);
        const entities = manager.create(Block, chunk);
        const batch = await manager.save(entities);
        savedBlocks.push(...batch);
      }
      return savedBlocks;
    });
  }

  findAll(): Promise<Block[]> {
    return this.repo.find();
  }

  async deleteMany(where: { heightGte: number }, manager?: EntityManager): Promise<number | null | undefined> {
    const repo = manager ? manager.getRepository(IndexerState) : this.repo;
    return (
      await repo
        .createQueryBuilder()
        .delete()
        .from(Block)
        .where('height >= :height', { height: where.heightGte })
        .execute()
    ).affected;
  }
}
