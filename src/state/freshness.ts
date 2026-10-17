// Pure staleness rules for asynchronous worker replies. Every reply is checked against
// the scenario epoch (bumped on scenario load/reset), the preference-model revision
// (bumped on every learned update or preference reset) and its request/job id.
import type { PlanResult } from '../core/types';

export interface FreshnessContext {
  epoch: number;
  modelRevision: number;
}

export interface JobTicket extends FreshnessContext {
  jobId: number;
}

/** A plan is usable only if it is the latest request, for this scenario run and model. */
export function planIsFresh(res: Pick<PlanResult, 'epoch' | 'reqId' | 'modelRevision'>, ctx: FreshnessContext & { latestReqId: number }): boolean {
  return res.epoch === ctx.epoch && res.modelRevision === ctx.modelRevision && res.reqId === ctx.latestReqId;
}

/** A learning/evaluation reply is usable only if it answers the outstanding ticket unchanged. */
export function jobIsFresh(jobId: number, ticket: JobTicket | null, ctx: FreshnessContext): boolean {
  return !!ticket && ticket.jobId === jobId && ticket.epoch === ctx.epoch && ticket.modelRevision === ctx.modelRevision;
}
