import { Injectable, Logger } from '@nestjs/common';
import { Big } from 'big.js';

import { AppConfigService } from '../app.config';
import { Block } from '../entities/block/block.entity';
import { BlockService } from '../entities/block/block.service';
import { Lease } from '../entities/lease/lease.entity';
import { LeaseService } from '../entities/lease/lease.service';
import { Payment } from '../entities/payment/payment.entity';
import { PaymentService } from '../entities/payment/payment.service';
import { mapToRecord } from '../utils/map-to-record.util';

export class IndexerInfo {
  blocks: { total: number; minHeight: number; maxHeight: number };
  leases: number;
  payments: number;
}

/** @internal */
export class ChangePoint {
  height: number;
  amount: bigint;
}

/** @internal */
export class ChangePointDiff extends ChangePoint {
  diff: 'increase' | 'decrease' | 'base';
}

@Injectable()
export class PaymentsPayableService {
  private readonly logger = new Logger(PaymentsPayableService.name);

  private readonly nodeOwnerBeneficiaryAddress: string;
  private readonly percentageToDistribute: bigint;

  constructor(
    private readonly config: AppConfigService,
    private readonly blockService: BlockService,
    private readonly leaseService: LeaseService,
    private readonly paymentService: PaymentService
  ) {
    this.nodeOwnerBeneficiaryAddress = this.config.nodeOwnerBeneficiaryAddress;
    this.percentageToDistribute = BigInt(this.config.percentageToDistribute);
    this.logger.log('Node owner beneficiary address:', this.nodeOwnerBeneficiaryAddress);
    this.logger.log('Percentage to distribute:', this.percentageToDistribute);
  }

  async getSummaryData(): Promise<
    | {
        indexerInfo: IndexerInfo;
        rewardsDistribution: Record<string, { amount: string; percent: string }>;
        debt: Record<string, string>;
      }
    | undefined
  > {
    this.logger.log('Starting payment calculation...');

    const { blocks, leases, payments, indexerInfo } = await this.getFullIndexerData();
    this.logger.log('Found', indexerInfo);

    if (indexerInfo.blocks.total === 0) {
      return undefined;
    }

    const genBalanceChangePointsBySender = this.calculateGenerativeBalancePointsBySender(leases);
    this.logger.log('Found', [...genBalanceChangePointsBySender.keys()].length, 'uniq leasers');

    const rewardsDistributionBySender = this.getRewardsDistributionByAddress(blocks, genBalanceChangePointsBySender);
    this.logger.log('RewardsDistributionBySender:', rewardsDistributionBySender.size);

    const debtBySender = this.getDebtByAddress(rewardsDistributionBySender, payments);
    this.logger.log('DebtBySender:', debtBySender.size);

    return {
      indexerInfo,
      rewardsDistribution: mapToRecord(rewardsDistributionBySender),
      debt: mapToRecord(debtBySender),
    };
  }

  private async getFullIndexerData(): Promise<{
    blocks: Block[];
    leases: Lease[];
    payments: Payment[];
    indexerInfo: IndexerInfo;
  }> {
    const blocks = (await this.blockService.findAll()).sort((a, b) => a.height - b.height);
    const leases = await this.leaseService.findAll();
    const payments = await this.paymentService.findAll();

    const minHeight = blocks.length === 0 ? 0 : Math.min(...blocks.map((block) => block.height));
    const maxHeight = Math.max(...blocks.map((block) => block.height), 0);

    const indexerInfo = {
      blocks: { total: blocks.length, minHeight, maxHeight },
      leases: leases.length,
      payments: payments.length,
    };

    return { blocks, leases, payments, indexerInfo };
  }

  private calculateGenerativeBalancePointsBySender(leases: Lease[]): Map<string, ChangePoint[]> {
    const result = new Map<string, ChangePoint[]>();
    const leasesMap = this.getLeasesMap(leases);
    for (const [sender, leases] of leasesMap.entries()) {
      const leasesBalanceAtChangePointsDiff = this.calculateLeaseChangePointsDiff(leases);
      const generativeBalanceAtChangePoints = this.calculateGenerativePoints(leasesBalanceAtChangePointsDiff);
      result.set(sender, generativeBalanceAtChangePoints);

      // log
      // this.logger.debug(
      //   `For sender: ${leases[0].sender}:`,
      //   `\nLeases:`,
      //   leases.map((lease) => {
      //     return { amount: lease.amount, height: lease.height, cancelHeight: lease.cancelHeight };
      //   }),
      //   `\nGenerativeBalance at change points:`,
      //   generativeBalanceAtChangePoints
      // );
    }
    return result;
  }

  private getLeasesMap(leases: Lease[]): Map<string, Lease[]> {
    const result = new Map<string, Lease[]>();
    for (const lease of leases) {
      if (result.has(lease.sender)) {
        result.get(lease.sender)!.push(lease);
      } else {
        result.set(lease.sender, [lease]);
      }
    }
    return result;
  }

  private calculateLeaseChangePointsDiff(leases: Lease[]): ChangePointDiff[] {
    const balanceMap = new Map<number, bigint>();

    for (const lease of leases) {
      const leaseAmount = BigInt(lease.amount);
      balanceMap.set(lease.height, (balanceMap.get(lease.height) ?? 0n) + leaseAmount);
      if (lease.cancelHeight) {
        balanceMap.set(lease.cancelHeight, (balanceMap.get(lease.cancelHeight) ?? 0n) - leaseAmount);
      }
    }

    const diffPoints: ChangePointDiff[] = [...balanceMap.entries()]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_height, amount]) => amount !== 0n)
      .map(
        ([height, amount]): ChangePointDiff => ({
          height,
          amount,
          diff: amount > 0n ? 'increase' : 'decrease',
        })
      )
      .sort((a, b) => a.height - b.height);

    let accumulatedAmount = 0n;
    return diffPoints.map((point): ChangePointDiff => {
      accumulatedAmount += point.amount;
      return { height: point.height, amount: accumulatedAmount, diff: point.diff };
    });
  }

  private calculateGenerativePoints(leasesBalanceAtChangePoints: ChangePointDiff[]): ChangePoint[] {
    if (leasesBalanceAtChangePoints.length === 0) {
      return [];
    }

    const windowSize = 1000;

    const heights = leasesBalanceAtChangePoints
      .map((pt) => {
        if (pt.diff === 'increase') {
          return pt.height + windowSize;
        }
        return pt.height;
      })
      .sort((a, b) => a - b);

    // Add first point 0 for correct windowing of the first lease
    leasesBalanceAtChangePoints.unshift({
      height: leasesBalanceAtChangePoints[0].height - 1,
      amount: 0n,
      diff: 'base',
    });

    // Compute the generative balance at each change point
    const generativePoints: ChangePoint[] = heights.map((height) => {
      const windowStart = height - windowSize;
      const windowEnd = height;
      // Find the minimum balance in the window [windowStart, windowEnd]
      const minAmount = leasesBalanceAtChangePoints
        .filter((pt) => pt.height >= windowStart && pt.height <= windowEnd)
        .reduce((prev, curr) => {
          const prevVal = prev.amount;
          const currVal = curr.amount;
          return currVal < prevVal ? curr : prev;
        }).amount;
      return { height: windowEnd, amount: minAmount };
    });

    // Sort by height and remove duplicate (keep first occurrence by height or amount), remove first point 0
    const uniquePoints: ChangePoint[] = [];
    let lastPoint: ChangePoint | undefined = undefined;
    for (const pt of generativePoints) {
      if (
        (!lastPoint && pt.amount !== 0n) ||
        (lastPoint && pt.height !== lastPoint.height && pt.amount !== lastPoint.amount)
      ) {
        uniquePoints.push(pt);
        lastPoint = pt;
      }
    }

    return uniquePoints;
  }

  private getRewardsDistributionByAddress(
    blocks: Block[],
    genBalanceChangePointsBySender: Map<string, ChangePoint[]>
  ): Map<string, { amount: string; percent: string }> {
    this.logger.log('Calculating rewards distribution...');

    const e8 = BigInt(1e8);

    const rewardsE8DistributionBySender = new Map<string, bigint>();
    let totalReward = 0n;

    let timer = Date.now();
    for (let i = 0; i < blocks.length; i++) {
      //Log progress
      if (i !== 0 && i % 1000 === 0) {
        this.logger.debug(`${i + 1} / ${blocks.length}`, 'took', Date.now() - timer, 'ms');
        timer = Date.now();
      }

      const block = blocks[i];
      const reward = this.getReward(block);
      totalReward += reward;

      // this.logger.debug(`Block: ${block.height}, reward: ${reward}`);

      // Get generative balance for the current block by sender
      const genBalancesForCurrentBlockBySender = new Map<string, bigint>();
      let totalGenBalance = 0n;
      for (const [sender, changePoints] of genBalanceChangePointsBySender.entries()) {
        const genPointBeforeBlockHeight = changePoints.findLast((pt) => pt.height < block.height);
        if (genPointBeforeBlockHeight) {
          genBalancesForCurrentBlockBySender.set(sender, genPointBeforeBlockHeight.amount);
          totalGenBalance += genPointBeforeBlockHeight.amount;
        }
      }

      // Distribute reward proportionally to gen balances
      if (totalGenBalance > 0) {
        for (const [sender, balance] of genBalancesForCurrentBlockBySender.entries()) {
          // share = (balance / totalGenBalance) * reward * (percentageToDistribute / 100) (multiply 1e8 to increase the precision of natural numbers division)
          const shareE8 = (balance * e8 * reward * this.percentageToDistribute) / totalGenBalance / 100n;

          const previous = rewardsE8DistributionBySender.get(sender);
          rewardsE8DistributionBySender.set(sender, previous ? previous + shareE8 : shareE8);
          // this.logger.debug(`Block: ${block.height}, sender: ${sender} distribution:`, shareE8 / e8);
        }
      }
    }
    this.logger.log(`TotalReward to distribute:`, totalReward);

    //Prepare result convert BigInt 1e8 values to string
    const result = new Map<string, { amount: string; percent: string }>();
    let totalShared = 0n;
    for (const [sender, balanceE8] of rewardsE8DistributionBySender.entries()) {
      const balance = balanceE8 / e8;
      const amount = balance.toString();
      totalShared += balance;
      result.set(sender, { amount: amount, percent: Big(amount).div(totalReward.toString()).mul(100).toFixed(3) });
    }

    // Distribute the rest reward to the node owner
    const ownerDistribution = totalReward - totalShared;
    const existing = result.get(this.nodeOwnerBeneficiaryAddress);
    const updatedAmount = BigInt(existing?.amount ?? '0') + ownerDistribution;
    result.set(this.nodeOwnerBeneficiaryAddress, {
      amount: updatedAmount.toString(),
      percent: Big(updatedAmount.toString()).div(totalReward.toString()).mul(100).toFixed(3),
    });

    return result;
  }

  private getReward(block: Block): bigint {
    return BigInt(block.blockReward) + (BigInt(block.fee) * 4n + BigInt(block.previousFee) * 6n) / 10n;
  }

  private getDebtByAddress(
    totalDistributeBySender: Map<string, { amount: string; percent: string }>,
    payments: Payment[]
  ): Map<string, string> {
    // Sum actual payments per sender from the Payment entities
    const actualPaid = new Map<string, bigint>();
    for (const payment of payments) {
      const addr = payment.address;
      const amt = BigInt(payment.amount);
      actualPaid.set(addr, (actualPaid.get(addr) ?? 0n) + amt);
    }

    // Compute debt (expected - actual) for each sender
    const debtBySender = new Map<string, string>();
    for (const [sender, expected] of totalDistributeBySender.entries()) {
      const paid = actualPaid.get(sender) ?? 0n;
      const diff = BigInt(expected.amount) - paid;
      debtBySender.set(sender, diff.toString());
    }

    return debtBySender;
  }
}
