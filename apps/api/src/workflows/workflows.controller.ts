import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { WorkflowsService } from "./workflows.service";

@Controller("workflows")
@UseGuards(ClerkAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get("templates")
  async listTemplates() {
    return this.workflows.listTemplates();
  }

  @Get("templates/:profile")
  async getTemplate(
    @Param("profile") profile: "general" | "service_scheduling" | "project_lifecycle" | "compliance_heavy",
  ) {
    return this.workflows.getTemplate(profile);
  }
}
