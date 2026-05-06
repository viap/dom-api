import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SocialNetworks } from '@/common/enums/social-networks.enum';

@Schema({ _id: false })
export class PartnerLink {
  @Prop({ required: true, enum: Object.values(SocialNetworks) })
  platform: SocialNetworks;

  @Prop({ trim: true })
  url?: string;

  @Prop({ trim: true })
  value?: string;
}

export const partnerLinkSchema = SchemaFactory.createForClass(PartnerLink);
