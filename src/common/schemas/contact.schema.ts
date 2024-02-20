import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SocialNetworks } from '../enums/social-networks.enum';

@Schema()
export class Contact {
  @Prop()
  id: string;

  @Prop({ required: true, enum: Object.values(SocialNetworks) })
  network: SocialNetworks;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true, default: false })
  hidden: boolean;
}

export const contactSchema = SchemaFactory.createForClass(Contact);
