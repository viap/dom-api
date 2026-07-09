import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from './enums/therapy-request-analytics.enum';
import { computeTherapyRequestAnalyticsReviewRequired } from './therapy-request-classifier.core';
import { TherapyRequestClassifierService } from './therapy-request-classifier.service';

describe('TherapyRequestClassifierService', () => {
  const service = new TherapyRequestClassifierService();

  it('infers category and stores low-confidence gender as unknown', () => {
    const result = service.classify({
      name: 'Client',
      descr: 'Семейный запрос про отношения и конфликты',
      contacts: [],
    });

    expect(result.requestCategory).toBe(TherapyRequestCategory.Family);
    expect(result.clientGender).toBe(TherapyRequestClientGender.Unknown);
    expect(result.analyticsReviewRequired).toBe(true);
    expect(result.analyticsInference.requestCategory.reasons[0]).toContain(
      'Matched request category signal',
    );
  });

  it('does not overwrite manually reviewed analytics fields', () => {
    const result = service.classify({
      name: 'Client',
      descr: 'Запрос про ребенка',
      current: {
        clientGender: TherapyRequestClientGender.Other,
        requestCategory: TherapyRequestCategory.Individual,
        topic: 'Manual topic',
        analyticsInference: {
          clientGender: {
            value: TherapyRequestClientGender.Other,
            confidence: 1,
            sources: ['admin'],
            reasons: ['Manual'],
            manual: true,
          },
          requestCategory: {
            value: TherapyRequestCategory.Individual,
            confidence: 1,
            sources: ['admin'],
            reasons: ['Manual'],
            manual: true,
          },
          topic: {
            value: 'Manual topic',
            confidence: 1,
            sources: ['admin'],
            reasons: ['Manual'],
            manual: true,
          },
        },
      },
    });

    expect(result.clientGender).toBe(TherapyRequestClientGender.Other);
    expect(result.requestCategory).toBe(TherapyRequestCategory.Individual);
    expect(result.topic).toBe('Manual topic');
  });

  it('reclassifies self-reported analytics fields because they are not admin manual locks', () => {
    const result = service.classify({
      name: 'Client',
      descr: 'Женщина ищет индивидуальную работу с тревогой',
      current: {
        clientGender: TherapyRequestClientGender.Male,
        requestCategory: TherapyRequestCategory.Family,
        analyticsInference: {
          clientGender: {
            value: TherapyRequestClientGender.Male,
            confidence: 1,
            sources: ['create_payload'],
            reasons: ['Self-reported during therapy request creation'],
            manual: false,
            selfReported: true,
          },
          requestCategory: {
            value: TherapyRequestCategory.Family,
            confidence: 1,
            sources: ['create_payload'],
            reasons: ['Self-reported during therapy request creation'],
            manual: false,
            selfReported: true,
          },
        },
      },
    });

    expect(result.clientGender).toBe(TherapyRequestClientGender.Female);
    expect(result.requestCategory).toBe(TherapyRequestCategory.Individual);
    expect(result.analyticsInference.clientGender.selfReported).toBeUndefined();
    expect(
      result.analyticsInference.requestCategory.selfReported,
    ).toBeUndefined();
  });

  it('keeps self-reported values in the review queue', () => {
    const reviewRequired = computeTherapyRequestAnalyticsReviewRequired(
      {
        clientGender: TherapyRequestClientGender.Female,
        requestCategory: TherapyRequestCategory.Individual,
        topic: 'Женщина ищет индивидуальную работу с тревогой',
      },
      {
        clientGender: {
          value: TherapyRequestClientGender.Female,
          confidence: 1,
          sources: ['create_payload'],
          reasons: ['Self-reported during therapy request creation'],
          manual: false,
          selfReported: true,
        },
        requestCategory: {
          value: TherapyRequestCategory.Individual,
          confidence: 1,
          sources: ['create_payload'],
          reasons: ['Self-reported during therapy request creation'],
          manual: false,
          selfReported: true,
        },
        topic: {
          value: 'Женщина ищет индивидуальную работу с тревогой',
          confidence: 0.68,
          sources: ['descr'],
          reasons: ['Used the first meaningful request text fragment as topic'],
          manual: false,
        },
      },
    );

    expect(reviewRequired).toBe(true);
  });

  it('does not match gender signals inside unrelated Cyrillic words', () => {
    const result = service.classify({
      descr: 'Хочу, чтобы меня понимали и принимали',
    });

    expect(result.clientGender).toBe(TherapyRequestClientGender.Unknown);
    expect(result.analyticsReviewRequired).toBe(true);
  });

  it('does not infer client gender from relational family-member terms', () => {
    const result = service.classify({
      descr: 'Проблемы с женой, постоянные конфликты',
    });

    expect(result.clientGender).toBe(TherapyRequestClientGender.Unknown);
    expect(result.requestCategory).toBe(TherapyRequestCategory.Family);
  });

  it('does not match category stems inside unrelated words', () => {
    const result = service.classify({
      descr: 'Хочу обсудить предмет подробно на семинаре',
    });

    expect(result.requestCategory).toBe(TherapyRequestCategory.Unknown);
  });

  it('keeps individual category confidence above the category threshold', () => {
    const result = service.classify({
      descr: 'Индивидуальная работа с тревогой',
    });

    expect(result.requestCategory).toBe(TherapyRequestCategory.Individual);
    expect(
      result.analyticsInference.requestCategory.confidence,
    ).toBeGreaterThanOrEqual(0.75);
    expect(result.analyticsReviewRequired).toBe(true);
  });

  it('clears review for high-confidence automatic classification', () => {
    const result = service.classify({
      descr: 'Женщина ищет индивидуальную работу с тревогой',
    });

    expect(result.clientGender).toBe(TherapyRequestClientGender.Female);
    expect(result.requestCategory).toBe(TherapyRequestCategory.Individual);
    expect(
      result.analyticsInference.clientGender.confidence,
    ).toBeGreaterThanOrEqual(0.75);
    expect(
      result.analyticsInference.requestCategory.confidence,
    ).toBeGreaterThanOrEqual(0.75);
    expect(result.analyticsInference.topic.confidence).toBeGreaterThanOrEqual(
      0.65,
    );
    expect(result.analyticsReviewRequired).toBe(false);
  });
});
