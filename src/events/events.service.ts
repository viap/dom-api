import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import { resolveExistingIds } from '@/common/utils/resolve-ids';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { DomainsService } from '@/domains/domains.service';
import { LocationsService } from '@/locations/locations.service';
import { MediaService } from '@/media/media.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventStatus } from './enums/event-status.enum';
import { EventQueryParams } from './types/query-params.interface';
import {
  DomainEvent,
  DomainEventDocument,
} from './schemas/domain-event.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(DomainEvent.name)
    private eventModel: Model<DomainEventDocument>,
    private domainsService: DomainsService,
    private locationsService: LocationsService,
    private mediaService: MediaService,
    private peopleService: PeopleService,
    private partnersService: PartnersService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<DomainEventDocument> {
    await this.validateDomainAndRefs(createEventDto);
    await this.ensureUniqueSlug(createEventDto.domainId, createEventDto.slug);

    const event = new this.eventModel(createEventDto);
    return event.save();
  }

  async findAll(
    queryParams: EventQueryParams = {},
  ): Promise<DomainEventDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const domainId =
      typeof safeParams.domainId === 'string' ? safeParams.domainId : null;
    if (domainId) {
      await this.domainsService.getActiveById(domainId);
    }

    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {
      status: { $ne: EventStatus.Draft },
    };
    if (domainId) {
      query.domainId = domainId;
    }

    return this.eventModel
      .find(query)
      .sort({ startAt: 1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<DomainEventDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const event = await this.eventModel
      .findOne({ _id: validId, status: { $ne: EventStatus.Draft } })
      .lean()
      .exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event as DomainEventDocument;
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<DomainEventDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const existingEvent = await this.eventModel.findById(validId).lean().exec();
    if (!existingEvent) {
      throw new NotFoundException('Event not found');
    }

    const domainId =
      updateEventDto.domainId || existingEvent.domainId.toString();
    const slug = updateEventDto.slug || existingEvent.slug;

    await this.validateDomainAndRefs({
      domainId,
      locationId:
        updateEventDto.locationId || existingEvent.locationId?.toString(),
      mediaId: updateEventDto.mediaId || existingEvent.mediaId?.toString(),
      speakerIds:
        updateEventDto.speakerIds ||
        existingEvent.speakerIds.map((id) => id.toString()),
      organizerIds:
        updateEventDto.organizerIds ||
        existingEvent.organizerIds.map((id) => id.toString()),
      partnerIds:
        updateEventDto.partnerIds ||
        existingEvent.partnerIds.map((id) => id.toString()),
    });
    await this.ensureUniqueSlug(domainId, slug, validId);

    const event = await this.eventModel
      .findByIdAndUpdate(validId, updateEventDto, { new: true })
      .lean()
      .exec();

    return event as DomainEventDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const result = await this.eventModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Event not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.eventModel.countDocuments({ _id: validId });
    return count > 0;
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.eventModel, ids);
  }

  private async validateDomainAndRefs(data: {
    domainId: string;
    locationId?: string;
    mediaId?: string;
    speakerIds?: string[];
    organizerIds?: string[];
    partnerIds?: string[];
  }): Promise<void> {
    await this.domainsService.getActiveById(data.domainId);

    if (data.locationId) {
      const exists = await this.locationsService.exists(data.locationId);
      if (!exists) {
        throw new BadRequestException('Referenced location not found');
      }
    }

    if (data.mediaId) {
      const mediaExists = await this.mediaService.existsPublished(data.mediaId);
      if (!mediaExists) {
        throw new BadRequestException('Referenced published media not found');
      }
    }

    await this.validatePeople(data.speakerIds || []);
    await this.validatePeople(data.organizerIds || []);
    await this.validatePartners(data.partnerIds || []);
  }

  private async validatePeople(ids: string[]): Promise<void> {
    for (const id of ids) {
      const exists = await this.peopleService.exists(id);
      if (!exists) {
        throw new BadRequestException(`Referenced person not found: ${id}`);
      }
    }
  }

  private async validatePartners(ids: string[]): Promise<void> {
    for (const id of ids) {
      const exists = await this.partnersService.exists(id);
      if (!exists) {
        throw new BadRequestException(`Referenced partner not found: ${id}`);
      }
    }
  }

  private async ensureUniqueSlug(
    domainId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = { domainId, slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.eventModel.findOne(query);
    if (existing) {
      throw new ConflictException(
        'Event with this slug already exists in the domain',
      );
    }
  }
}
