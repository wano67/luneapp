import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * Types alignés avec la spécification OpenAPI utilisée comme source unique.
 */
export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options'
  | 'head';

export type ParsedOperation = {
  method: HttpMethod;
  path: string;
  summary?: string;
  deprecated?: boolean;
  secure?: boolean;
  tags: string[];
};

export type EndpointGroup = { name: string; operations: ParsedOperation[] };
export type SchemaSummary = { name: string; description?: string };

type OperationObject = {
  summary?: string;
  operationId?: string;
  deprecated?: boolean;
  security?: Array<Record<string, unknown>>;
  tags?: string[];
};

type PathItemObject = Record<string, OperationObject>;

type OpenAPISpec = {
  paths?: Record<string, PathItemObject>;
  security?: Array<Record<string, unknown>>;
  components?: {
    schemas?: Record<
      string,
      {
        description?: string;
      }
    >;
  };
};

const METHOD_ORDER: HttpMethod[] = [
  'post',
  'get',
  'put',
  'patch',
  'delete',
  'options',
  'head',
];

function isHttpMethod(value: string): value is HttpMethod {
  return METHOD_ORDER.includes(value as HttpMethod);
}

function loadOpenApiSpec(): OpenAPISpec | null {
  const specPath = join(process.cwd(), 'public', 'openapi.yaml');
  let fileContent: string;

  try {
    fileContent = readFileSync(specPath, 'utf8');
  } catch (err) {
    console.error('Cannot read OpenAPI file at', specPath, err);
    return null;
  }

  try {
    return parse(fileContent) as OpenAPISpec;
  } catch (err) {
    console.error('Cannot parse OpenAPI YAML', err);
    return null;
  }
}

let cachedSpec: OpenAPISpec | null | undefined;

function getSpec(): OpenAPISpec | null {
  if (process.env.NODE_ENV !== 'production') {
    return loadOpenApiSpec();
  }

  if (cachedSpec !== undefined) return cachedSpec;
  cachedSpec = loadOpenApiSpec();
  return cachedSpec;
}

function isSecure(
  operation: OperationObject,
  documentSecurity?: OpenAPISpec['security']
): boolean {
  if (Array.isArray(operation.security) && operation.security.length > 0) {
    return true;
  }
  return Array.isArray(documentSecurity) && documentSecurity.length > 0;
}

/**
 * Construit les groupes d'endpoints à partir de la spec OpenAPI (public/openapi.yaml).
 * Les opérations sont regroupées par premier tag (ou "default") et triées par méthode puis path.
 */
export function buildEndpointGroups(): EndpointGroup[] {
  const document = getSpec();
  if (!document) return [];
  const paths = document.paths ?? {};
  const groups = new Map<string, ParsedOperation[]>();

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [methodKey, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(methodKey.toLowerCase())) continue;
      const method = methodKey.toLowerCase() as HttpMethod;
      const op = operation as OperationObject;
      const tags = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ['default'];
      const groupName = tags[0];

      const entry: ParsedOperation = {
        method,
        path,
        summary: op.summary || op.operationId,
        deprecated: op.deprecated === true,
        secure: isSecure(op, document.security),
        tags,
      };

      const existing = groups.get(groupName) ?? [];
      existing.push(entry);
      groups.set(groupName, existing);
    }
  }

  const sortedGroups: EndpointGroup[] = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, operations]) => {
      const sortedOps = [...operations].sort((a, b) => {
        const methodRank =
          METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
        if (methodRank !== 0) return methodRank;
        return a.path.localeCompare(b.path);
      });
      return { name, operations: sortedOps };
    });

  return sortedGroups;
}

/**
 * Retourne la liste des schémas définis dans la spec OpenAPI.
 */
export function buildSchemaList(): SchemaSummary[] {
  const document = getSpec();
  if (!document?.components?.schemas) return [];

  return Object.entries(document.components.schemas)
    .map(([name, schema]) => ({
      name,
      description: schema?.description,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
