import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { makeRegisterOrgUseCase } from '../../use-cases/factories/make-register-org-use-case.js';

export const registerOrgBodySchema = z.object({
  name: z
    .string({ error: 'O nome é obrigatório.' })
    .min(1, 'O nome não pode ser vazio.'),
  email: z
    .string({ error: 'O e-mail é obrigatório.' })
    .email('Informe um e-mail válido.'),
  password: z
    .string({ error: 'A senha é obrigatória.' })
    .min(6, 'A senha deve ter no mínimo 6 caracteres.'),
  whatsapp: z
    .string({ error: 'O WhatsApp é obrigatório.' })
    .regex(
      /^\+55\d{2}9?\d{8}$/,
      'O WhatsApp deve estar no formato +55DDDNÚMERO (ex: +5511912345678).',
    ),
  cep: z
    .string({ error: 'O CEP é obrigatório.' })
    .regex(/^\d{8}$/, 'O CEP deve conter exatamente 8 dígitos numéricos.'),
  city: z.string({ error: 'A cidade deve ser um texto.' }).optional(),
  state: z.string({ error: 'O estado deve ser um texto.' }).optional(),
  address: z.string({ error: 'O endereço deve ser um texto.' }).optional(),
});

export async function registerOrgController(
  request: FastifyRequest<{ Body: z.infer<typeof registerOrgBodySchema> }>,
  reply: FastifyReply,
) {
  const registerOrg = makeRegisterOrgUseCase();
  await registerOrg.execute(request.body);
  return reply.status(201).send();
}
