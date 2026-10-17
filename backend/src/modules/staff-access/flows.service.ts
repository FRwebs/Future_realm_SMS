import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { PROCESS_FLOWS, isFlowId, type FlowId, type FlowStageData } from "../../../../src/lib/modules/staff-flows";
import { store } from "./staff-access.shared";

const stageSchema = z.object({
  name: z.string().trim().min(1, "Name the stage."),
  who: z.string().min(1, "Say who acts here."),
  does: z.string().min(1, "Say what they may do."),
  scope: z.string().min(1),
  win: z.string().min(1),
  silence: z.string().min(1),
  notify: z.array(z.string()).default(["Nobody"]),
  reason: z.string().trim().optional(),
  tell: z.coerce.boolean().optional()
});

/**
 * The sequences a school runs its decisions through. A school that has not changed one reads
 * the default; the first change writes it down as the school's own, and every later reader —
 * leave routing, appraisal cycle, payroll release — follows what is written.
 */
@Injectable()
export class FlowsService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private definition(id: string) {
    if (!isFlowId(id)) throw new NotFoundException("That process does not exist.");
    return PROCESS_FLOWS[id];
  }

  /** The stages as the school has them now. */
  async stages(schoolId: string, id: FlowId): Promise<FlowStageData[]> {
    const saved = await store(schoolId, "process-flows").get<{ stages?: FlowStageData[] }>(id);
    return saved?.data.stages ?? PROCESS_FLOWS[id].stages.map((stage) => ({ ...stage, notify: [...stage.notify] }));
  }

  async get(session: SessionPayload, id: string) {
    const definition = this.definition(id);
    const stages = await this.stages(session.schoolId, definition.id);
    const saved = await store(session.schoolId, "process-flows").get(id);
    return { id: definition.id, stages, customised: Boolean(saved) };
  }

  private async save(session: SessionPayload, id: FlowId, stages: FlowStageData[], summary: string, reason?: string) {
    await store(session.schoolId, "process-flows").put(id, PROCESS_FLOWS[id].plainLabel, { stages, changedAt: new Date().toISOString(), changedBy: session.userId });
    await prisma.auditLog.create({
      data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "ProcessFlow", entityId: id, metadata: { summary, reason: reason ?? null, stages: stages.length } }
    });
    return { id, stages };
  }

  async addStage(session: SessionPayload, id: string, body: unknown) {
    const definition = this.definition(id);
    const input = stageSchema.parse(body);
    const stages = await this.stages(session.schoolId, definition.id);
    const { reason, tell: _tell, ...stage } = input;
    void _tell;
    stages.push(stage);
    return this.save(session, definition.id, stages, `Stage added to ${definition.plainLabel.toLowerCase()} · ${stage.name}`, reason);
  }

  async updateStage(session: SessionPayload, id: string, index: number, body: unknown) {
    const definition = this.definition(id);
    const input = stageSchema.parse(body);
    const stages = await this.stages(session.schoolId, definition.id);
    if (!stages[index]) throw new NotFoundException("That stage does not exist.");
    const { reason, tell: _tell, ...stage } = input;
    void _tell;
    stages[index] = stage;
    return this.save(session, definition.id, stages, `Stage changed in ${definition.plainLabel.toLowerCase()} · ${stage.name}`, reason);
  }

  async removeStage(session: SessionPayload, id: string, index: number) {
    const definition = this.definition(id);
    const stages = await this.stages(session.schoolId, definition.id);
    if (!stages[index]) throw new NotFoundException("That stage does not exist.");
    if (stages.length === 1) throw new BadRequestException("A sequence needs at least one stage, or nothing would ever be decided.");
    const [removed] = stages.splice(index, 1);
    return this.save(session, definition.id, stages, `Stage removed from ${definition.plainLabel.toLowerCase()} · ${removed.name}`);
  }

  async move(session: SessionPayload, id: string, body: unknown) {
    const definition = this.definition(id);
    const input = z.object({ index: z.number().int(), delta: z.number().int().min(-1).max(1) }).parse(body);
    const stages = await this.stages(session.schoolId, definition.id);
    const target = input.index + input.delta;
    if (!stages[input.index] || target < 0 || target >= stages.length) throw new BadRequestException("It cannot move any further.");
    [stages[input.index], stages[target]] = [stages[target], stages[input.index]];
    return this.save(session, definition.id, stages, `Stage moved in ${definition.plainLabel.toLowerCase()} · ${stages[target].name}`);
  }

  async preset(session: SessionPayload, id: string, body: unknown) {
    const definition = this.definition(id);
    const input = z.object({ label: z.string() }).parse(body);
    const preset = definition.presets.find((item) => item.label === input.label);
    if (!preset) throw new NotFoundException("That starting point does not exist.");
    const base = preset.stages ?? definition.stages;
    const stages = base.map((stage) => ({ ...stage, notify: [...stage.notify] }));
    if (preset.append) stages.push({ ...preset.append, notify: [...preset.append.notify] });
    return this.save(session, definition.id, stages, `${definition.plainLabel} set to “${preset.label}”`);
  }
}
