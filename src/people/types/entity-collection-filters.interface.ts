import { PersonAvailability } from '../enums/person-availability.enum';
import { Languages } from '../enums/languages.enum';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';

export interface PeopleEntityCollectionFilters {
  roles?: PersonRole[];
  specializations?: string[];
  availability?: PersonAvailability[];
  workFormats?: WorkFormat[];
  workLocationIds?: string[];
  languages?: Languages[];
}
