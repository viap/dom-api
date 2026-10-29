import { ApplicationFormType } from './enums/application-form-type.enum';

const MAX_DISPLAY_VALUE_CODE_POINTS = 300;
const HEADER_PREFIX = 'Новая заявка с сайта: ';
const LINK_LABEL = 'Открыть заявку';
const REPLY_HEADER = 'Новый ответ по заявке';

const FORM_TYPE_LABELS: Record<ApplicationFormType, string> = {
  [ApplicationFormType.General]: 'Общее обращение',
  [ApplicationFormType.Partnership]: 'Партнёрство',
  [ApplicationFormType.ProgramEnrollment]: 'Запись на программу',
  [ApplicationFormType.EventRegistration]: 'Запись на мероприятие',
  [ApplicationFormType.CorporateTraining]: 'Корпоративное обучение',
  [ApplicationFormType.SpecialistRequest]: 'Подбор специалиста',
  [ApplicationFormType.Supervision]: 'Супервизия',
};

export interface ApplicationNotificationInput {
  formType: ApplicationFormType;
  applicantName: string;
  targetTitle?: string | null;
  publicWebOrigin: string;
  applicationUrl: string;
}

export interface FormattedApplicationNotification {
  message: string;
  messageEntities: Array<{
    type: 'text_link';
    offset: number;
    length: number;
    url: string;
  }>;
}

export function normalizeNotificationDisplayValue(value: string): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  const codePoints = Array.from(normalized);
  if (codePoints.length <= MAX_DISPLAY_VALUE_CODE_POINTS) {
    return normalized;
  }

  return `${codePoints.slice(0, MAX_DISPLAY_VALUE_CODE_POINTS - 1).join('')}…`;
}

export function buildApplicationAdminUrl(
  publicWebOrigin: string,
  applicationId: string,
): string {
  const url = new URL('/ru/admin/applications', publicWebOrigin);
  url.searchParams.set('applicationId', applicationId);
  return url.toString();
}

export function formatApplicationNotification(
  input: ApplicationNotificationInput,
): FormattedApplicationNotification {
  const publicUrl = new URL('/', input.publicWebOrigin).toString();
  const siteAddress = new URL(input.publicWebOrigin).host;
  const header = `${HEADER_PREFIX}${siteAddress}`;
  const lines = [
    `Тип: ${FORM_TYPE_LABELS[input.formType]}`,
    `Имя: ${normalizeNotificationDisplayValue(input.applicantName)}`,
  ];
  const targetTitle = input.targetTitle
    ? normalizeNotificationDisplayValue(input.targetTitle)
    : '';

  if (targetTitle && input.formType === ApplicationFormType.ProgramEnrollment) {
    lines.push(`Программа: ${targetTitle}`);
  }
  if (targetTitle && input.formType === ApplicationFormType.EventRegistration) {
    lines.push(`Мероприятие: ${targetTitle}`);
  }

  const details = lines.join('\n');
  const message = `${header}\n\n${details}\n\n${LINK_LABEL}`;
  const applicationLinkOffset = message.length - LINK_LABEL.length;

  return {
    message,
    messageEntities: [
      {
        type: 'text_link',
        offset: HEADER_PREFIX.length,
        length: siteAddress.length,
        url: publicUrl,
      },
      {
        type: 'text_link',
        offset: applicationLinkOffset,
        length: LINK_LABEL.length,
        url: input.applicationUrl,
      },
    ],
  };
}

export function formatApplicationReplyNotification(input: {
  applicantName: string;
  applicationUrl: string;
}): FormattedApplicationNotification {
  const message = `${REPLY_HEADER}\nИмя: ${normalizeNotificationDisplayValue(
    input.applicantName,
  )}\n\n${LINK_LABEL}`;

  return {
    message,
    messageEntities: [
      {
        type: 'text_link',
        offset: message.length - LINK_LABEL.length,
        length: LINK_LABEL.length,
        url: input.applicationUrl,
      },
    ],
  };
}
