import * as Joi from 'joi';
import { NotificationMessageEntity } from '../types/notification-message-entity';

const MAX_NOTIFICATION_MESSAGE_ENTITIES = 50;

const joiNotificationMessageEntitySchema =
  Joi.alternatives<NotificationMessageEntity>().try(
    Joi.object({
      type: Joi.string().valid('url').required(),
      offset: Joi.number().integer().min(0).required(),
      length: Joi.number().integer().min(1).required(),
    }),
    Joi.object({
      type: Joi.string().valid('text_link').required(),
      offset: Joi.number().integer().min(0).required(),
      length: Joi.number().integer().min(1).required(),
      url: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .required(),
    }),
  );

function validateMessageEntityBounds(
  entities: Array<NotificationMessageEntity>,
  helpers: Joi.CustomHelpers,
) {
  const root = helpers.state.ancestors[0] as { message?: string } | undefined;
  const message = root?.message || '';

  if (
    entities.some((entity) => entity.offset + entity.length > message.length)
  ) {
    return helpers.error('any.invalid');
  }

  return entities;
}

export const joiNotificationMessageEntitiesSchema = Joi.array<
  Array<NotificationMessageEntity>
>()
  .max(MAX_NOTIFICATION_MESSAGE_ENTITIES)
  .items(joiNotificationMessageEntitySchema)
  .custom(validateMessageEntityBounds, 'message entity bounds validation');
