import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class PlanAiMessagingGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    void context;
    return true;
  }
}
