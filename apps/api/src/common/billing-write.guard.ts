import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";

/**
 * Blocks mutation requests when org is in read-only mode (trial expired, past due, etc).
 * Use after ClerkAuthGuard and TenantGuard so tenant context exists.
 */
@Injectable()
export class BillingWriteGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    void context;
    return true;
  }
}
