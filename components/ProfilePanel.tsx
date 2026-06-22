'use client';

/**
 * ProfilePanel
 *
 * Collapsed-by-default panel showing business profile fields.
 * Header: business_category + detected geo (targetGeographies/serviceAreas).
 * Body: business_identity, primary_verticals chips, inventory_nature,
 *       explicit_out_of_scope chips.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import type { ClientProfile } from '@/lib/queries';

interface ProfilePanelProps {
  profile: ClientProfile;
}

interface BusinessProfile {
  business_category?: string;
  business_identity?: string;
  primary_verticals?: string[];
  inventory_nature?: string;
  explicit_out_of_scope?: string[];
}

function ChipList({ items, colorClass }: { items: string[]; colorClass: string }) {
  if (!items || items.length === 0) return <span className="text-on-surface-muted text-sm">None</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="chip list">
      {items.map((item) => (
        <li
          key={item}
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function ProfilePanel({ profile }: ProfilePanelProps) {
  const [open, setOpen] = useState(false);

  const bp = (profile.businessProfile ?? {}) as BusinessProfile;
  const geo = profile.geo ?? { targetGeographies: [], serviceAreas: [] };

  const geoItems = [
    ...(geo.targetGeographies ?? []),
    ...(geo.serviceAreas ?? []),
  ].filter(Boolean);

  const category = bp.business_category ?? '';

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="profile-body"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-3 bg-surface-muted cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-on-surface-muted" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-on-surface-muted" aria-hidden="true" />
        )}

        <span className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-on-surface block truncate">
            {category || 'Business Profile'}
          </span>
          {geoItems.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-on-surface-muted mt-0.5">
              <MapPin size={11} aria-hidden="true" />
              {geoItems.slice(0, 3).join(', ')}
              {geoItems.length > 3 && ` +${geoItems.length - 3} more`}
            </span>
          )}
        </span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div id="profile-body" className="px-4 py-4 bg-surface-elevated flex flex-col gap-4">
          {/* Business Identity */}
          <div>
            <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide mb-1">
              Business Identity
            </h3>
            <p className="text-sm text-on-surface leading-relaxed">
              {bp.business_identity || <span className="text-on-surface-muted">Not specified</span>}
            </p>
          </div>

          {/* Primary Verticals */}
          <div>
            <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide mb-1.5">
              Primary Verticals
            </h3>
            <ChipList
              items={bp.primary_verticals ?? []}
              colorClass="bg-primary text-primary-fg"
            />
          </div>

          {/* Inventory Nature */}
          <div>
            <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide mb-1">
              Inventory Nature
            </h3>
            <p className="text-sm text-on-surface leading-relaxed">
              {bp.inventory_nature || <span className="text-on-surface-muted">Not specified</span>}
            </p>
          </div>

          {/* Out of Scope */}
          <div>
            <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide mb-1.5">
              Explicit Out of Scope
            </h3>
            <ChipList
              items={bp.explicit_out_of_scope ?? []}
              colorClass="bg-danger-surface text-danger"
            />
          </div>

          {/* Geo Details */}
          {((geo.targetGeographies ?? []).length > 0 || (geo.serviceAreas ?? []).length > 0) && (
            <div>
              <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide mb-1.5">
                Geography
              </h3>
              {(geo.targetGeographies ?? []).length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-on-surface-muted mb-1">Target Geographies</p>
                  <ChipList
                    items={geo.targetGeographies ?? []}
                    colorClass="bg-surface-muted text-on-surface"
                  />
                </div>
              )}
              {(geo.serviceAreas ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-on-surface-muted mb-1">Service Areas</p>
                  <ChipList
                    items={geo.serviceAreas ?? []}
                    colorClass="bg-surface-muted text-on-surface"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
