import { Badge } from '../../../components/Badge';
import type { AccountStatus } from '../../../api/types';

// Riders have exactly two statuses (go-ride-backend/domain/user/entity.go).
// Neutral, factual labels only — self-service deactivation is out of scope for this
// milestone, so a rider should in practice only ever see 'active'; 'deactivated' is
// handled defensively so the badge renders correctly if it is ever encountered.
const LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  deactivated: 'Deactivated',
};

const VARIANTS: Record<AccountStatus, 'active' | 'inactive'> = {
  active: 'active',
  deactivated: 'inactive',
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge label={LABELS[status]} variant={VARIANTS[status]} />;
}
