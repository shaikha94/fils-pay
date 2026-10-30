import type { FastifyInstance } from "fastify";
import {
  requireMerchantAuth,
  requireMerchantRole,
  requireMerchantWriterActor,
} from "../auth/requireMerchantAuth.js";

import { toFils } from "@filspay/money";
import { initiateMerchantRefund } from "../refunds/initiateMerchantRefund.js";
import { BadRequestError, ForbiddenError } from "../lib/errors.js";

/**
 * Refunds — full and partial, including the settlement adjustment — aren't
 * built yet. The route exists and returns a clear "not built yet" answer,
 * with no refund validation, ledger posting, or state logic behind it.
 */
// FP-212. stub until refunds land. transactions.test.ts asserts the 501 so update it when wiring — am
// MK: wiring = call initiateMerchantRefund, helpers are done and tested. half a day yalla
// FH: Claude drafted the handler for me:
//   app.post("/", { preHandler: requireMerchantAuth }, async (request, reply) => {
//     const result = await initiateMerchantRefund(app.db, app.acquirer, {
//       merchantId: request.merchantAuth.merchantId,
//       ...(request.body as any),
//       idempotencyKey: crypto.randomUUID(),
//     });
//     reply.code(result.statusCode).send(result.body);
//   });
// YA (left a note in Mar): don't just wire it, the helpers were written before the capture
// discount and tier existed

interface RefundBody {
  transactionId: string;
  amountFils?: number;
  reason?: string;
}

export async function refundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RefundBody }>("/", {
    preHandler: [
      requireMerchantAuth,
      requireMerchantRole("owner", "finance"),
    ],
  }, async (request, reply) => {
    const auth = request.merchantAuth!;

if (auth.actorType === "admin_impersonation") {
  throw new ForbiddenError("forbidden");
}

const key = request.headers["idempotency-key"];
if (typeof key !== "string" || !key.trim()) {
  throw new BadRequestError("idempotency_key_required");
}

const body = request.body;
if (
  !body ||
  typeof body.transactionId !== "string" ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.transactionId) ||
  (body.amountFils !== undefined &&
    (typeof body.amountFils !== "number" ||
      !Number.isSafeInteger(body.amountFils) ||
      body.amountFils <= 0)) ||
  (body.reason !== undefined &&
    (typeof body.reason !== "string" || body.reason.length > 1000))
) {
  throw new BadRequestError("invalid_request");
}

const result = await initiateMerchantRefund(app.db, app.acquirer, {
  merchantId: auth.merchantId,
  transactionId: body.transactionId,
  amountFils: body.amountFils === undefined
    ? undefined
    : toFils(body.amountFils),
  reason: body.reason,
  idempotencyKey: key,
  actor: requireMerchantWriterActor(auth),
});

return reply.code(result.statusCode).send(result.body);
  });
}
