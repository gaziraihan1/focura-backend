import { FeatureRepository }  from './feature.repository.js';
import { isFocuraAdmin }      from '../../config/admin.config.js';
import type {
  CreateFeatureRequestInput,
  UpdateFeatureStatusInput,
  FeatureFilterParams,
  VoteType,
} from './feature.types.js';

export const FeatureService = {
  async create(input: CreateFeatureRequestInput) {
    return FeatureRepository.create(input);
  },

  async getMany(params: FeatureFilterParams, userId: string) {
    return FeatureRepository.findMany(params, userId);
  },

  async getOne(id: string, userId: string) {
    const feature = await FeatureRepository.findById(id, userId);
    if (!feature) throw new Error('NOT_FOUND: Feature request not found');
    return feature;
  },

  async updateStatus(id: string, userId: string, input: UpdateFeatureStatusInput) {
    if (!isFocuraAdmin(userId))
      throw new Error('FORBIDDEN: Only Focura admins can update feature status');

    const feature = await FeatureRepository.findById(id, null);
    if (!feature) throw new Error('NOT_FOUND: Feature request not found');

    return FeatureRepository.updateStatus(id, input);
  },

  async delete(id: string, userId: string) {
    if (!isFocuraAdmin(userId))
      throw new Error('FORBIDDEN: Only Focura admins can delete feature requests');

    const feature = await FeatureRepository.findById(id, null);
    if (!feature) throw new Error('NOT_FOUND: Feature request not found');

    await FeatureRepository.delete(id);
    return { success: true };
  },

  async vote(id: string, userId: string, type: VoteType) {
    const feature = await FeatureRepository.findById(id, null);
    if (!feature) throw new Error('NOT_FOUND: Feature request not found');

    // Only APPROVED and PLANNED features are open for voting
    if (feature.status !== 'APPROVED' && feature.status !== 'PLANNED')
      throw new Error('BAD_REQUEST: Voting is only allowed on approved or planned features');

    const action = await FeatureRepository.vote(id, userId, type);
    const updated = await FeatureRepository.findById(id, userId);
    return { action, feature: updated };
  },
};