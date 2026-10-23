import { ApplicationFormType } from './enums/application-form-type.enum';
import {
  buildApplicationAdminUrl,
  formatApplicationNotification,
  normalizeNotificationDisplayValue,
} from './application-notification';

describe('application notification formatting', () => {
  const expectedLabels: Record<ApplicationFormType, string> = {
    [ApplicationFormType.General]: 'Общее обращение',
    [ApplicationFormType.Partnership]: 'Партнёрство',
    [ApplicationFormType.ProgramEnrollment]: 'Запись на программу',
    [ApplicationFormType.EventRegistration]: 'Запись на мероприятие',
    [ApplicationFormType.CorporateTraining]: 'Корпоративное обучение',
    [ApplicationFormType.SpecialistRequest]: 'Подбор специалиста',
  };

  it.each(Object.values(ApplicationFormType))(
    'formats the %s application type without private fields',
    (formType) => {
      const formatted = formatApplicationNotification({
        formType,
        applicantName: 'Anna',
        targetTitle: 'Target',
        publicWebOrigin: 'https://www.example.test',
        applicationUrl: 'https://www.example.test/application',
      });

      expect(formatted.message).toContain(
        'Новая заявка с сайта: www.example.test',
      );
      expect(formatted.message).toContain(`Тип: ${expectedLabels[formType]}`);
      expect(formatted.message).toContain('Имя: Anna');
      expect(formatted.message).not.toContain('contact');
      expect(formatted.messageEntities).toHaveLength(2);
    },
  );

  it('adds only the applicable program or event title', () => {
    const program = formatApplicationNotification({
      formType: ApplicationFormType.ProgramEnrollment,
      applicantName: 'Anna',
      targetTitle: 'Program A',
      publicWebOrigin: 'https://www.example.test',
      applicationUrl: 'https://www.example.test/application',
    });
    const event = formatApplicationNotification({
      formType: ApplicationFormType.EventRegistration,
      applicantName: 'Anna',
      targetTitle: 'Event A',
      publicWebOrigin: 'https://www.example.test',
      applicationUrl: 'https://www.example.test/application',
    });

    expect(program.message).toContain('Программа: Program A');
    expect(program.message).not.toContain('Мероприятие:');
    expect(event.message).toContain('Мероприятие: Event A');
    expect(event.message).not.toContain('Программа:');
  });

  it('computes the link offset from the final UTF-16 prefix', () => {
    const formatted = formatApplicationNotification({
      formType: ApplicationFormType.EventRegistration,
      applicantName: '👩‍💻 Открыть заявку <b>Anna</b>',
      targetTitle: 'Семья 👨‍👩‍👧‍👦',
      publicWebOrigin: 'https://пример.рф:3006',
      applicationUrl: 'https://www.example.test/application',
    });
    const [siteEntity, applicationEntity] = formatted.messageEntities;

    expect(
      formatted.message.slice(
        siteEntity.offset,
        siteEntity.offset + siteEntity.length,
      ),
    ).toBe(new URL('https://пример.рф:3006').host);
    expect(
      formatted.message.slice(
        applicationEntity.offset,
        applicationEntity.offset + applicationEntity.length,
      ),
    ).toBe('Открыть заявку');
    expect(formatted.message.match(/Открыть заявку/gu)).toHaveLength(2);
    expect(siteEntity.url).toBe('https://xn--e1afmkfd.xn--p1ai:3006/');
    expect(applicationEntity.url).toBe('https://www.example.test/application');
  });

  it('formats both links from the public site origin', () => {
    const formatted = formatApplicationNotification({
      formType: ApplicationFormType.EventRegistration,
      applicantName: 'Влад',
      targetTitle: 'Первый семинар',
      publicWebOrigin: 'https://psydom.org',
      applicationUrl:
        'https://psydom.org/ru/admin/applications?applicationId=507f1f77bcf86cd799439031',
    });

    expect(formatted.message).toBe(`Новая заявка с сайта: psydom.org

Тип: Запись на мероприятие
Имя: Влад
Мероприятие: Первый семинар

Открыть заявку`);
    expect(formatted.messageEntities).toEqual([
      {
        type: 'text_link',
        offset: 'Новая заявка с сайта: '.length,
        length: 'psydom.org'.length,
        url: 'https://psydom.org/',
      },
      {
        type: 'text_link',
        offset: formatted.message.lastIndexOf('Открыть заявку'),
        length: 'Открыть заявку'.length,
        url: 'https://psydom.org/ru/admin/applications?applicationId=507f1f77bcf86cd799439031',
      },
    ]);
  });

  it('normalizes whitespace and limits display values to 300 code points', () => {
    const normalized = normalizeNotificationDisplayValue(
      `  Anna\n\t${'😀'.repeat(400)}  `,
    );

    expect(normalized).not.toMatch(/[\n\t]/u);
    expect(Array.from(normalized)).toHaveLength(300);
    expect(normalized.endsWith('…')).toBe(true);
  });

  it('builds an encoded direct application URL', () => {
    expect(
      buildApplicationAdminUrl(
        'https://psydom.org',
        '507f1f77bcf86cd799439031',
      ),
    ).toBe(
      'https://psydom.org/ru/admin/applications?applicationId=507f1f77bcf86cd799439031',
    );
  });
});
