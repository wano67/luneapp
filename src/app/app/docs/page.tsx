// src/app/app/docs/page.tsx
import {
  type EndpointGroup as ParsedGroup,
  buildEndpointGroups,
  buildSchemaList,
} from '@/lib/openapi/endpoint-groups';

export const runtime = 'nodejs';

type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

type Endpoint = {
  method: HttpMethod;
  path: string;
  summary: string;
  secured?: boolean;
  deprecated?: boolean;
};

type EndpointGroup = {
  name: string;
  endpoints: Endpoint[];
};

const METHOD_STYLES: Record<
  HttpMethod,
  {
    bg: string;
    border: string;
    bgSoft: string;
  }
> = {
  OPTIONS: {
    bg: '#0D5AA7',
    border: '#0D5AA7',
    bgSoft: 'rgba(13, 90, 167, 0.10)',
  },
  HEAD: {
    bg: '#9012FE',
    border: '#9012FE',
    bgSoft: 'rgba(144, 18, 254, 0.10)',
  },
  DELETE: {
    bg: '#F93E3E',
    border: '#F93E3E',
    bgSoft: 'rgba(249, 62, 62, 0.10)',
  },
  PATCH: {
    bg: '#50E3C2',
    border: '#50E3C2',
    bgSoft: 'rgba(80, 227, 194, 0.10)',
  },
  PUT: {
    bg: '#FCA130',
    border: '#FCA130',
    bgSoft: 'rgba(252, 161, 48, 0.10)',
  },
  GET: {
    bg: '#61AFFE',
    border: '#61AFFE',
    bgSoft: 'rgba(97, 175, 254, 0.10)',
  },
  POST: {
    bg: '#49CC90',
    border: '#49CC90',
    bgSoft: '#EEFAF5',
  },
};

function MethodBadge({ method }: { method: HttpMethod }) {
  const style = METHOD_STYLES[method];

  return (
    <div
      className="flex flex-col items-center justify-center rounded-[3px] px-3 py-1.5"
      style={{ background: style.bg }}
    >
      <span
        className="font-mono text-[14px] font-bold text-white"
        style={{ letterSpacing: 0 }}
      >
        {method}
      </span>
    </div>
  );
}

function ChevronIcon() {
  return (
    <div className="relative h-6 w-6 overflow-hidden">
      <div
        className="absolute rounded-[1px]"
        style={{
          width: 16,
          height: 8,
          left: 4,
          top: 8,
          outline: '1.5px var(--text-secondary) solid',
          outlineOffset: '-0.75px',
        }}
      />
    </div>
  );
}

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  const { method, path, summary, secured, deprecated } = endpoint;
  const style = METHOD_STYLES[method];

  return (
    <details
      className="w-full rounded-[3px] shadow-sm"
      style={{
        background:
          method === 'POST'
            ? style.bgSoft
            : `linear-gradient(0deg, ${style.bgSoft} 0%, ${style.bgSoft} 100%), var(--surface)`,
        outline: `1px ${style.border} solid`,
        outlineOffset: '-0.5px',
      }}
    >
      <summary className="flex cursor-pointer items-center justify-between px-[5px] py-[5px] text-left">
        <div className="flex items-center gap-[6px]">
          <MethodBadge method={method} />
          <span className="font-mono text-[12px] font-bold lowercase text-[var(--text-primary)]">
            {path}
          </span>
          <span className="font-mono text-[12px] font-semibold capitalize text-[var(--text-secondary)]">
            {summary}
          </span>
        </div>
        <div className="flex items-center gap-[6px]">
          <ChevronIcon />
        </div>
      </summary>
      <div className="border-t border-[var(--border)] bg-[var(--background-alt)] px-4 py-3 text-xs text-[var(--text-primary)] space-y-2">
        {secured && (
          <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
            🔒 Auth required
          </span>
        )}
        {deprecated && (
          <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
            ⚠️ Deprecated
          </span>
        )}
        <p className="text-[var(--text-primary)]">
          {summary || 'Aucune description fournie dans la spec OpenAPI.'}
        </p>
        <p className="text-[var(--text-secondary)]">
          Détails requête/réponse à venir (body, query params, réponses, etc.).
        </p>
      </div>
    </details>
  );
}

function EndpointGroupBlock({ group }: { group: EndpointGroup }) {
  return (
    <details className="w-full rounded-[3px] border border-[var(--border)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {group.name}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {group.endpoints.length} endpoint
          {group.endpoints.length > 1 ? 's' : ''}
        </span>
      </summary>
      <div className="space-y-2 border-t border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
        {group.endpoints.map((ep) => (
          <EndpointRow key={`${ep.method}-${ep.path}`} endpoint={ep} />
        ))}
      </div>
    </details>
  );
}

function MethodLegend() {
  const order: HttpMethod[] = [
    'OPTIONS',
    'HEAD',
    'DELETE',
    'PATCH',
    'PUT',
    'GET',
    'POST',
  ];

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3">
      {order.map((method) => {
        const style = METHOD_STYLES[method];
        return (
          <div
            key={method}
            className="flex flex-col items-center justify-center rounded-[3px] px-3 py-1.5"
            style={{ background: style.bg }}
          >
            <span className="font-mono text-[14px] font-bold text-white">
              {method}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ApiDocsPage() {
  const parsedGroups: ParsedGroup[] = buildEndpointGroups();
  const schemas = buildSchemaList();
  const groups: EndpointGroup[] = parsedGroups.map((group) => ({
    name: group.name,
    endpoints: group.operations.map((op) => ({
      method: op.method.toUpperCase() as HttpMethod,
      path: op.path,
      summary: op.summary ?? '',
      secured: op.secure,
      deprecated: op.deprecated === true,
    })),
  }));

  const hasGroups = groups.length > 0;
  const hasSchemas = schemas.length > 0;

  if (!hasGroups && !hasSchemas) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm space-y-2">
          <h1 className="text-xl font-semibold">API docs</h1>
          <p className="text-[var(--text-secondary)]">
            Aucune route n&apos;a été trouvée dans <code>public/openapi.yaml</code>.
            Vérifie que le fichier existe et qu&apos;il contient bien une section{' '}
            <code>paths</code> et/ou <code>components.schemas</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        {/* Colonne méthodes (OPTIONS / HEAD / …) */}
        <div className="sticky top-20 hidden shrink-0 md:block">
          <MethodLegend />
        </div>

        {/* Contenu principal Swagger-like */}
        <div className="flex-1 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md">
          {/* Header */}
          <header className="mb-6 flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                StudioFief API
              </h1>
              <p className="font-mono text-xs text-[var(--text-secondary)]">
                /openapi.json
              </p>
            </div>

            <button className="inline-flex items-center gap-2 rounded border border-emerald-400 px-3 py-1.5 text-xs font-medium text-emerald-600">
              <span>Authorize</span>
              <span className="h-3 w-3 rounded border border-emerald-400" />
            </button>
          </header>

          {/* Groups */}
          <div className="space-y-4">
            {groups.map((group) => (
              <EndpointGroupBlock key={group.name} group={group} />
            ))}
          </div>

          {/* Zone schemas placeholder */}
          <section className="mt-8 rounded-[3px] border border-[var(--border)] bg-[var(--surface-hover)] p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
              Schemas
            </h2>
            {schemas.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Aucun schéma déclaré dans la spec pour le moment.
              </p>
            ) : (
              <ul className="space-y-1 text-xs text-[var(--text-primary)]">
                {schemas.map((schema) => (
                  <li
                    key={schema.name}
                    className="flex items-start justify-between rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <span className="font-mono font-semibold">{schema.name}</span>
                    {schema.description ? (
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {schema.description}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
