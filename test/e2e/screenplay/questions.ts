import { CallAnApi, TakeNotes } from './abilities';
import { Question } from './core';
import { LAST_MOVEMENT } from './tasks';

export const LastResponse = {
  status: () =>
    Question.about(
      'the status of the last response',
      async (actor) => CallAnApi.as(actor).lastResponse.status,
    ),
  body: <T = any>() =>
    Question.about(
      'the body of the last response',
      async (actor) => CallAnApi.as(actor).lastResponse.body as T,
    ),
  header: (name: string) =>
    Question.about(`the "${name}" header of the last response`, async (actor) =>
      CallAnApi.as(actor).lastResponse.headers.get(name),
    ),
  /** The first bytes of a binary body, which is where a PDF says it is one. */
  signature: () =>
    Question.about('the first bytes of the last response', async (actor) =>
      CallAnApi.as(actor).lastResponse.raw.subarray(0, 5).toString('latin1'),
    ),
};

/** What GET /stock says is on hand of a product at a location, in bottles. */
export const StockLevel = {
  of: (productId: string, locationId: string) =>
    Question.about(`the stock of the product at the location`, async (actor) => {
      const { data } = await CallAnApi.as(actor).read<{ data: { quantityBase: number }[] }>(
        '/stock',
        { productIds: productId, locationId },
      );
      return data[0]?.quantityBase ?? 0;
    }),
};

export interface MovementView {
  id: string;
  code: string;
  type: string;
  status: string;
  reason: string | null;
  cancelledAt: string | null;
  items: {
    productId: string;
    locationId: string;
    quantity: number;
    unit: string;
    quantityBase: number;
  }[];
}

/** Reads the last movement back from GET /movements/:id, as the detail page does. */
export const TheMovement = {
  asStored: () =>
    Question.about('the movement as the API stores it', async (actor) => {
      const id = TakeNotes.as(actor).get<string>(LAST_MOVEMENT);
      return CallAnApi.as(actor).read<MovementView>(`/movements/${id}`);
    }),
};

/** The newest kardex line of a product at a location: what the ledger wrote last. */
export const LatestKardexEntry = {
  of: (productId: string, locationId: string) =>
    Question.about('the latest kardex entry of the product', async (actor) => {
      const { data } = await CallAnApi.as(actor).read<{
        data: { movementCode: string; quantityBase: number; balanceAfter: number }[];
      }>(`/stock/${productId}/kardex`, { locationId });
      return data[0];
    }),
};
