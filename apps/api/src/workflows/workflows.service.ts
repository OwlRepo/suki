import { Injectable } from "@nestjs/common";
import {
  WORKFLOW_TEMPLATES,
  type WorkflowProfile,
} from "./workflow-templates";

@Injectable()
export class WorkflowsService {
  getTemplate(profile: WorkflowProfile) {
    return WORKFLOW_TEMPLATES[profile] ?? WORKFLOW_TEMPLATES.general;
  }

  listTemplates() {
    return Object.values(WORKFLOW_TEMPLATES);
  }
}
