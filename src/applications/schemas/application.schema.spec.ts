import mongoose from 'mongoose';
import { applicationSchema } from './application.schema';

const ApplicationModel =
  mongoose.models.ApplicationPreferredContactTest ||
  mongoose.model('ApplicationPreferredContactTest', applicationSchema);

const baseApplication = {
  domainId: new mongoose.Types.ObjectId(),
  formType: 'general',
  payload: { message: 'Support' },
};

describe('Application preferred contact persistence', () => {
  it('keeps legacy applicants without materializing preferredContact', () => {
    const doc = new ApplicationModel({
      ...baseApplication,
      applicant: {
        name: 'Jane',
        contacts: [{ network: 'other', username: 'jane@example.com' }],
      },
    });

    expect(doc.validateSync()).toBeUndefined();
    const applicant = doc.toObject().applicant;
    expect(applicant.preferredContact).toBeUndefined();
    expect(applicant.contacts).toHaveLength(1);
  });

  it('persists a V3 phone preferred contact and one legacy projection', () => {
    const doc = new ApplicationModel({
      ...baseApplication,
      schemaVersion: 3,
      applicant: {
        name: 'Jane',
        preferredContact: {
          type: 'phone',
          phoneE164: '+995555123456',
          whatsappAvailable: true,
        },
        contacts: [{ network: 'phone', username: '+995555123456' }],
      },
    });

    expect(doc.validateSync()).toBeUndefined();
    const applicant = doc.toObject().applicant;
    expect(applicant.preferredContact).toEqual({
      type: 'phone',
      phoneE164: '+995555123456',
      whatsappAvailable: true,
    });
    expect(applicant.contacts).toHaveLength(1);
  });
});
