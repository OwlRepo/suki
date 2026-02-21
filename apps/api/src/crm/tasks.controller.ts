import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { CrmModeGuard } from "../common/crm-mode.guard";
import { TasksService } from "./tasks.service";

@Controller("crm/tasks")
@UseGuards(ClerkAuthGuard, CrmModeGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async list(
    @Tenant("organizationId") orgId: string,
    @Query("businessId") businessId: string,
    @Query("customerId") customerId?: string,
    @Query("dealId") dealId?: string,
    @Query("incompleteOnly") incompleteOnly?: string,
  ) {
    if (!businessId) throw new Error("businessId required");
    const list = await this.tasksService.list(businessId, orgId!, {
      customerId,
      dealId,
      incompleteOnly: incompleteOnly === "true",
    });
    return { tasks: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Tenant("userId") userId: string,
    @Body() body: {
      businessId: string;
      customerId?: string;
      dealId?: string;
      title: string;
      dueAt?: string;
      assigneeUserId?: string;
    },
  ) {
    const task = await this.tasksService.create(orgId!, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      assigneeUserId: body.assigneeUserId,
    });
    return { task };
  }

  @Post(":id/complete")
  async complete(
    @Tenant("organizationId") orgId: string,
    @Param("id") id: string,
    @Query("businessId") businessId: string,
  ) {
    if (!businessId) throw new Error("businessId required");
    const task = await this.tasksService.complete(id, orgId!);
    return { task };
  }
}
