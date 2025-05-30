import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { IndexerState } from './entities/indexer-state.entity';

@Injectable()
export class IndexerStateService implements OnModuleInit {
  private readonly logger = new Logger(IndexerStateService.name);

  constructor(
    @InjectRepository(IndexerState)
    private readonly repo: Repository<IndexerState>
  ) {}

  async onModuleInit() {
    const state = await this._ensureSingletonExists();
    this.logger.log('Found:', state);
  }

  getState(): Promise<IndexerState> {
    return this._ensureSingletonExists();
  }

  async updateFromHeight(height: number, force = false, manager?: EntityManager): Promise<void> {
    const state = await this.getState();
    if (!force && state.fromHeight > 0) {
      throw new Error('Cannot update fromHeight: already initialized');
    }
    this.logger.log(`Saving to DB... fromHeight: ${height}`);
    const repo = manager ? manager.getRepository(IndexerState) : this.repo;
    await repo.save({ id: 'singleton', fromHeight: height });
  }

  async updateIndexedHeight<T extends number | null>(height: T, manager?: EntityManager): Promise<T> {
    const repo = manager ? manager.getRepository(IndexerState) : this.repo;
    await repo.save({ id: 'singleton', indexedHeight: height });
    return height;
  }

  private async _ensureSingletonExists(): Promise<IndexerState> {
    let state = await this.repo.findOne({ where: { id: 'singleton' } });
    if (!state) {
      this.logger.log('Creating IndexerState singleton...');
      state = this.repo.create({ id: 'singleton', fromHeight: 0 });
      await this.repo.save(state);
    }
    return state;
  }
}
