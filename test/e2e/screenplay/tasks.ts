import { E2E_NOTE, environment } from '../support/environment';
import { type ApiRequest, CallAnApi, TakeNotes } from './abilities';
import { type Activity, type Actor, type Answerable, Interaction, Task } from './core';

export type MovementType = 'OUTBOUND' | 'INBOUND' | 'TRANSFER' | 'ADJUSTMENT';
export type Unit = 'BOTTLE' | 'CASE';

export interface MovementLine {
  productId: string;
  quantity: number;
  unit?: Unit;
}

export interface MovementSpec {
  type: MovementType;
  items: MovementLine[];
  locationId?: string;
  destinationLocationId?: string;
  reason?: string;
}

/** Every movement this actor created, so the cleanup can void what a failure left behind. */
export const CREATED = 'createdMovementIds';
export const LAST_MOVEMENT = 'lastMovementId';

/** The atomic step: one HTTP request, answered into the ability's last response. */
export const Send = {
  a: (request: Answerable<ApiRequest>) =>
    Interaction.where(`#actor sends a request`, async (actor) => {
      await CallAnApi.as(actor).send(await actor.answer(request));
    }),
};

/**
 * Signs in through POST /auth/login like the frontend does. Goes through the
 * ability directly so the password never reaches the actor's journal.
 */
export const Authenticate = {
  withTheTestAccount: () =>
    Interaction.where('#actor signs in with the test account', async (actor) => {
      const api = CallAnApi.as(actor);
      const response = await api.send<{ accessToken: string }>({
        method: 'POST',
        path: '/auth/login',
        body: environment.credentials(),
        authenticated: false,
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Sign-in refused with ${response.status}: ${JSON.stringify(response.body)}`,
        );
      }
      api.useToken(response.body.accessToken);
    }),
};

const remember = (actor: Actor, id: string) => {
  const notes = TakeNotes.as(actor);
  notes.set(LAST_MOVEMENT, id);
  notes.set(CREATED, [...(notes.has(CREATED) ? notes.get<string[]>(CREATED) : []), id]);
};

const lastMovementId = (actor: Actor) => TakeNotes.as(actor).get<string>(LAST_MOVEMENT);

/** Opens a DRAFT, which touches no stock yet. */
export const OpenADraft = {
  of: (spec: MovementSpec) =>
    Interaction.where(`#actor opens a ${spec.type} draft`, async (actor) => {
      const response = await CallAnApi.as(actor).send({
        method: 'POST',
        path: '/movements',
        body: {
          ...spec,
          items: spec.items.map((item) => ({ unit: 'BOTTLE', ...item })),
          note: E2E_NOTE,
        },
      });
      if (response.status !== 201) {
        throw new Error(`Draft refused with ${response.status}: ${JSON.stringify(response.body)}`);
      }
      remember(actor, response.body.id);
    }),
};

/** Asks to confirm the last movement and leaves the outcome to the questions. */
export const ConfirmTheMovement = () =>
  Interaction.where('#actor confirms the movement', async (actor) => {
    await CallAnApi.as(actor).send({
      method: 'POST',
      path: `/movements/${lastMovementId(actor)}/confirm`,
    });
  });

/** The whole journey the frontend makes: draft, then confirm. */
export const RegisterMovement = {
  of: (spec: MovementSpec): Activity =>
    Task.where(
      `#actor registers a ${spec.type} movement`,
      OpenADraft.of(spec),
      ConfirmTheMovement(),
    ),
};

export const CancelTheMovement = {
  withReason: (reason: string | undefined) =>
    Interaction.where(`#actor voids the movement`, async (actor) => {
      await CallAnApi.as(actor).send({
        method: 'POST',
        path: `/movements/${lastMovementId(actor)}/cancel`,
        body: reason === undefined ? {} : { reason },
      });
    }),
};

export const DownloadTheReceipt = {
  ofTheMovement: ({ authenticated = true } = {}) =>
    Interaction.where('#actor downloads the movement voucher', async (actor) => {
      await CallAnApi.as(actor).send({
        method: 'GET',
        path: `/movements/${lastMovementId(actor)}/pdf`,
        authenticated,
      });
    }),
  of: (movementId: string) =>
    Interaction.where('#actor downloads a voucher by id', async (actor) => {
      await CallAnApi.as(actor).send({ method: 'GET', path: `/movements/${movementId}/pdf` });
    }),
};

/**
 * The safety net: whatever this actor created and is still a draft or
 * confirmed gets voided, so stock ends where it started. A void that does not
 * go through fails the scenario out loud, naming the movement: left silent, it
 * would sit in the ledger and skew every later stock reading.
 */
export const VoidWhatWasLeftBehind = () =>
  Interaction.where('#actor voids what the scenario left behind', async (actor) => {
    const notes = TakeNotes.as(actor);
    if (!notes.has(CREATED)) return;
    const api = CallAnApi.as(actor);
    const leftBehind: string[] = [];
    for (const id of [...notes.get<string[]>(CREATED)].reverse()) {
      const movement = await api.read<{ code: string; status: string }>(`/movements/${id}`);
      if (movement.status === 'CANCELLED') continue;
      const voided = await api.send({
        method: 'POST',
        path: `/movements/${id}/cancel`,
        body: { reason: 'Cleanup after an E2E scenario' },
      });
      if (voided.status !== 201) {
        leftBehind.push(`${movement.code} (${movement.status}, cancel answered ${voided.status})`);
      }
    }
    notes.set(CREATED, []);
    if (leftBehind.length > 0) {
      throw new Error(`E2E cleanup could not void: ${leftBehind.join(', ')}`);
    }
  });
