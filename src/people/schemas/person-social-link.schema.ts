import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SocialNetworks } from '@/common/enums/social-networks.enum';

@Schema({ _id: false })
export class PersonSocialLink {
  @Prop({ required: true, enum: Object.values(SocialNetworks) })
  platform: SocialNetworks;

  @Prop({ required: true, trim: true })
  url: string;
}

export const personSocialLinkSchema =
  SchemaFactory.createForClass(PersonSocialLink);
