import type { Mode } from "../contracts/environment";

export interface NotificationCommand {
  command_id: string;
  command_type: string;
  tenant_id: string;
  mode: Mode;
  payload: Record<string, unknown>;
}

export interface WebhookCommand {
  command_id: string;
  command_type: string;
  tenant_id: string;
  mode: Mode;
  payload: Record<string, unknown>;
}

export interface NotificationCommandPublisher {
  publish(command: NotificationCommand): Promise<void>;
}

export interface WebhookCommandPublisher {
  publish(command: WebhookCommand): Promise<void>;
}

export class QueueNotificationCommandPublisher implements NotificationCommandPublisher {
  constructor(private readonly queue: Queue) {}

  async publish(command: NotificationCommand): Promise<void> {
    await this.queue.send(command);
  }
}

export class QueueWebhookCommandPublisher implements WebhookCommandPublisher {
  constructor(private readonly queue: Queue) {}

  async publish(command: WebhookCommand): Promise<void> {
    await this.queue.send(command);
  }
}
