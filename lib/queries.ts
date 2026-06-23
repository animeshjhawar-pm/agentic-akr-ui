import { runQuery, QueryClient } from './db';

export interface ClientRow {
  id: string;
  name: string;
}

export interface ClientProfile {
  businessProfile: object;
  geo: {
    targetGeographies: string[];
    serviceAreas: string[];
  };
}

export interface ResourceRow {
  id: string;
  type: 'product' | 'service';
  name: string;
  description: string;
}

/**
 * List all valid clients: projects where d_at IS NULL, additional_info has a
 * 'business_profile' key, and at least one live resource exists.
 */
export async function listClients(client: QueryClient): Promise<ClientRow[]> {
  const sql = `
    SELECT id, name
    FROM projects
    WHERE d_at IS NULL
      AND additional_info ? 'business_profile'
      AND EXISTS (
        SELECT 1 FROM resources r
        WHERE r.p_id = projects.id
          AND r.d_at IS NULL
      )
    ORDER BY name
  `;
  const result = await runQuery(client, sql);
  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

/**
 * Get business profile and geo data for a single client (project).
 * Uses parameterized query -- id is never string-interpolated.
 */
export async function getClientProfile(
  client: QueryClient,
  id: string,
): Promise<ClientProfile> {
  const sql = `
    SELECT
      additional_info->'business_profile' AS business_profile,
      company_info->'target_geographies' AS target_geographies,
      company_info->'service_areas' AS service_areas
    FROM projects
    WHERE id = $1
      AND d_at IS NULL
  `;
  const result = await runQuery(client, sql, [id]);
  const row = result.rows[0] ?? {};
  // service_areas / target_geographies are jsonb and are USUALLY arrays, but a
  // few clients store them as an object or string. Coerce anything non-array to
  // [] so downstream .filter()/[0] never throws (this was causing HTTP 500 on
  // Run for at least one client whose service_areas is a JSON object).
  return {
    businessProfile: (row.business_profile as object) ?? {},
    geo: {
      targetGeographies: Array.isArray(row.target_geographies)
        ? (row.target_geographies as string[])
        : [],
      serviceAreas: Array.isArray(row.service_areas)
        ? (row.service_areas as string[])
        : [],
    },
  };
}

/**
 * Get all live resources for a client. Names and descriptions are derived from
 * the details jsonb column based on resource type.
 * Uses parameterized query -- id is never string-interpolated.
 */
export async function getClientResources(
  client: QueryClient,
  id: string,
): Promise<ResourceRow[]> {
  const sql = `
    SELECT
      id,
      type,
      details
    FROM resources
    WHERE p_id = $1
      AND d_at IS NULL
  `;
  const result = await runQuery(client, sql, [id]);
  return result.rows.map((row) => {
    const details = (row.details as Record<string, string>) ?? {};
    const type = row.type as 'product' | 'service';
    let name = '';
    let description = '';

    if (type === 'service') {
      name = details.service_name ?? '';
      description = details.service_description ?? '';
    } else {
      name = details.product_name ?? '';
      const parts = [
        details.product_name,
        details.applications_use_cases,
        details.key_features_usps,
        details.technical_specifications,
      ].filter(Boolean);
      description = parts.join(' | ');
    }

    return {
      id: row.id as string,
      type,
      name,
      description,
    };
  });
}
