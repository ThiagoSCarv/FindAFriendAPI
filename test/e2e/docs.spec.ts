import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '@/app';

type OperationWithBody = {
  requestBody?: {
    content?: Record<
      string,
      { schema?: { properties?: Record<string, unknown> } }
    >;
  };
};

type OpenApiSpec = {
  paths?: Record<string, { post?: OperationWithBody }>;
};

function requestBodyProperties(path: string) {
  const spec = app.swagger() as OpenApiSpec;
  const requestBody = spec.paths?.[path]?.post?.requestBody;
  return {
    requestBody,
    properties: requestBody?.content?.['application/json']?.schema?.properties,
  };
}

describe('OpenAPI / Scalar documentation', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a request body schema for POST /orgs', () => {
    const { requestBody, properties } = requestBodyProperties('/orgs');

    expect(requestBody).toBeDefined();
    expect(Object.keys(properties ?? {})).toEqual(
      expect.arrayContaining(['name', 'email', 'password', 'whatsapp', 'cep']),
    );
  });

  it('exposes a request body schema for POST /sessions', () => {
    const { requestBody, properties } = requestBodyProperties('/sessions');

    expect(requestBody).toBeDefined();
    expect(Object.keys(properties ?? {})).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });
});
