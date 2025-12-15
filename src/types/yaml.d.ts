declare module '*.yaml' {
  const value: unknown;
  export default value;
}

declare module 'yaml' {
  type ParseOptions = Record<string, unknown>;
  type StringifyOptions = Record<string, unknown>;

  export function parse<T = unknown>(input: string, options?: ParseOptions): T;
  export function stringify(input: unknown, options?: StringifyOptions): string;

  const YAML: {
    parse: typeof parse;
    stringify: typeof stringify;
  };

  export default YAML;
}
