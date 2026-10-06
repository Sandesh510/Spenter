import { Icon } from '../Icon';
import type { Bucket } from '../../lib/types';

/** Icon in a rounded tile. The colour comes from the bucket: Needs, Wants or Savings. */
export function CategoryTile({ icon, bucket, size = 16 }: { icon: string; bucket: Bucket; size?: number }) {
  return (
    <span className={`icon-tile tile-bg--${bucket} tone--${bucket}`} aria-hidden="true">
      <Icon name={icon} size={size} />
    </span>
  );
}
