import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from './enums/therapy-request-analytics.enum';
import {
  AnalyticsFieldInferenceValue,
  TherapyRequestAnalyticsInference,
} from './types/therapy-request-analytics.types';

export { TherapyRequestCategory, TherapyRequestClientGender };

export interface TherapyRequestClassifierInput {
  name?: string;
  descr?: string;
  user?: { name?: string; contacts?: unknown[] };
  contacts?: unknown[];
  current?: {
    clientGender?: TherapyRequestClientGender;
    requestCategory?: TherapyRequestCategory;
    analyticsInference?: TherapyRequestAnalyticsInference;
  };
}

export interface TherapyRequestClassification {
  clientGender: TherapyRequestClientGender;
  requestCategory: TherapyRequestCategory;
  analyticsReviewRequired: boolean;
  analyticsInference: TherapyRequestAnalyticsInference;
}

const CLIENT_GENDER_CONFIDENCE_THRESHOLD = 0.75;
const REQUEST_CATEGORY_CONFIDENCE_THRESHOLD = 0.75;

function normalizeText(value?: string): string {
  return (value || '').toLowerCase().trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasCyrillicWord(text: string, signal: string): boolean {
  return new RegExp(`(?<![а-яё])${escapeRegExp(signal)}(?![а-яё])`, 'u').test(
    text,
  );
}

function hasCyrillicPrefix(text: string, signal: string): boolean {
  return new RegExp(`(?<![а-яё])${escapeRegExp(signal)}[а-яё]*`, 'u').test(
    text,
  );
}

function findSignal(
  text: string,
  signals: Array<{ value: string; prefix?: boolean }>,
): string | undefined {
  return signals.find((signal) =>
    signal.prefix
      ? hasCyrillicPrefix(text, signal.value)
      : hasCyrillicWord(text, signal.value),
  )?.value;
}

function fieldInference(
  value: string,
  confidence: number,
  sources: string[],
  reasons: string[],
  now: Date,
): AnalyticsFieldInferenceValue {
  return {
    value,
    confidence,
    sources,
    reasons,
    detectedAt: now,
    manual: false,
  };
}

function isManual(
  current: TherapyRequestClassifierInput['current'],
  field: keyof TherapyRequestAnalyticsInference,
): boolean {
  return current?.analyticsInference?.[field]?.manual === true;
}

function inferGender(
  input: TherapyRequestClassifierInput,
  now: Date,
): {
  value: TherapyRequestClientGender;
  inference: AnalyticsFieldInferenceValue;
} {
  const name = normalizeText(input.name || input.user?.name);
  const descr = normalizeText(input.descr);
  const text = `${name} ${descr}`;
  const femaleHit = findSignal(text, [
    { value: 'женщина' },
    { value: 'девушка' },
  ]);
  const maleHit = findSignal(text, [{ value: 'мужчина' }, { value: 'парень' }]);

  if (femaleHit && !maleHit) {
    return {
      value: TherapyRequestClientGender.Female,
      inference: fieldInference(
        TherapyRequestClientGender.Female,
        0.76,
        ['name', 'descr'],
        [`Matched explicit client gender signal "${femaleHit}"`],
        now,
      ),
    };
  }

  if (maleHit && !femaleHit) {
    return {
      value: TherapyRequestClientGender.Male,
      inference: fieldInference(
        TherapyRequestClientGender.Male,
        0.76,
        ['name', 'descr'],
        [`Matched explicit client gender signal "${maleHit}"`],
        now,
      ),
    };
  }

  return {
    value: TherapyRequestClientGender.Unknown,
    inference: fieldInference(
      TherapyRequestClientGender.Unknown,
      0.2,
      ['name', 'descr', 'contacts'],
      ['No reliable persisted gender signal found'],
      now,
    ),
  };
}

function inferCategory(
  input: TherapyRequestClassifierInput,
  now: Date,
): {
  value: TherapyRequestCategory;
  inference: AnalyticsFieldInferenceValue;
} {
  const text = normalizeText(`${input.name || ''} ${input.descr || ''}`);
  const matchers: Array<{
    value: TherapyRequestCategory;
    confidence: number;
    signals: Array<{ value: string; prefix?: boolean }>;
  }> = [
    {
      value: TherapyRequestCategory.Child,
      confidence: 0.86,
      signals: [
        { value: 'ребен', prefix: true },
        { value: 'ребён', prefix: true },
        { value: 'подрост', prefix: true },
        { value: 'детск', prefix: true },
        { value: 'дети' },
        { value: 'ребёнок' },
        { value: 'ребенок' },
      ],
    },
    {
      value: TherapyRequestCategory.Family,
      confidence: 0.84,
      signals: [
        { value: 'семейн', prefix: true },
        { value: 'семья' },
        { value: 'пара' },
        { value: 'муж' },
        { value: 'мужа' },
        { value: 'мужем' },
        { value: 'муже' },
        { value: 'мужу' },
        { value: 'жена' },
        { value: 'жены' },
        { value: 'жену' },
        { value: 'женой' },
        { value: 'отношен', prefix: true },
        { value: 'родител', prefix: true },
      ],
    },
    {
      value: TherapyRequestCategory.Group,
      confidence: 0.82,
      signals: [
        { value: 'групп', prefix: true },
        { value: 'команда' },
        { value: 'коллектив' },
      ],
    },
    {
      value: TherapyRequestCategory.Individual,
      confidence: 0.78,
      signals: [
        { value: 'личн', prefix: true },
        { value: 'индивидуаль', prefix: true },
        { value: 'самооцен', prefix: true },
        { value: 'тревог', prefix: true },
        { value: 'депресс', prefix: true },
      ],
    },
  ];

  for (const matcher of matchers) {
    const signal = findSignal(text, matcher.signals);
    if (signal) {
      return {
        value: matcher.value,
        inference: fieldInference(
          matcher.value,
          matcher.confidence,
          ['descr', 'name'],
          [`Matched request category signal "${signal}"`],
          now,
        ),
      };
    }
  }

  return {
    value: TherapyRequestCategory.Unknown,
    inference: fieldInference(
      TherapyRequestCategory.Unknown,
      0.2,
      ['descr', 'name'],
      ['No reliable request category signal found'],
      now,
    ),
  };
}

export function computeTherapyRequestAnalyticsReviewRequired(
  values: {
    clientGender?: TherapyRequestClientGender | string;
    requestCategory?: TherapyRequestCategory | string;
  },
  inference: TherapyRequestAnalyticsInference = {},
): boolean {
  return (
    values.clientGender === TherapyRequestClientGender.Unknown ||
    values.requestCategory === TherapyRequestCategory.Unknown ||
    (inference.clientGender?.confidence || 0) <
      CLIENT_GENDER_CONFIDENCE_THRESHOLD ||
    (inference.requestCategory?.confidence || 0) <
      REQUEST_CATEGORY_CONFIDENCE_THRESHOLD ||
    inference.clientGender?.selfReported === true ||
    inference.requestCategory?.selfReported === true
  );
}

export function classifyTherapyRequestAnalytics(
  input: TherapyRequestClassifierInput,
  now = new Date(),
): TherapyRequestClassification {
  const current = input.current;
  const gender = isManual(current, 'clientGender')
    ? {
        value: current?.clientGender || TherapyRequestClientGender.Unknown,
        inference: current?.analyticsInference?.clientGender,
      }
    : inferGender(input, now);

  const category = isManual(current, 'requestCategory')
    ? {
        value: current?.requestCategory || TherapyRequestCategory.Unknown,
        inference: current?.analyticsInference?.requestCategory,
      }
    : inferCategory(input, now);

  const analyticsInference: TherapyRequestAnalyticsInference = {
    clientGender: gender.inference,
    requestCategory: category.inference,
  };

  return {
    clientGender: gender.value as TherapyRequestClientGender,
    requestCategory: category.value as TherapyRequestCategory,
    analyticsReviewRequired: computeTherapyRequestAnalyticsReviewRequired(
      {
        clientGender: gender.value,
        requestCategory: category.value,
      },
      analyticsInference,
    ),
    analyticsInference,
  };
}
