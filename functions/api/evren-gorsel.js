import { handleRequest } from '../../worker/index.js';

export async function onRequest(context) {
  return handleRequest(context.request, context.env, context);
}
