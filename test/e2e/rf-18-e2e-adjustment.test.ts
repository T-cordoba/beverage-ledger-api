import { afterEach, beforeAll, describe, it } from 'vitest';
import { Ensure } from './screenplay/core';
import { equals, hasProperties } from './screenplay/expectations';
import { LastResponse, LatestKardexEntry, StockLevel, TheMovement } from './screenplay/questions';
import { ConfirmTheMovement, OpenADraft, RegisterMovement, Send } from './screenplay/tasks';
import { environment, SCENARIO_TIMEOUT_MS, HOOK_TIMEOUT_MS } from './support/environment';
import { cleanUp, PRODUCT_SLOT, type Scene, setTheScene } from './support/stage';

const REASON = 'Physical count mismatch (E2E)';

describe.skipIf(!environment.shouldRun)(
  'RF-18 E2E - Register an inventory adjustment',
  { timeout: SCENARIO_TIMEOUT_MS },
  () => {
    let scene: Scene;

    beforeAll(async () => {
      scene = await setTheScene(PRODUCT_SLOT.rf18);
    }, HOOK_TIMEOUT_MS);

    afterEach(() => cleanUp(scene), HOOK_TIMEOUT_MS);

    it('a negative adjustment with a reason lowers the stock and keeps the reason', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const before = await actor.answer(StockLevel.of(wellStocked.productId, defaultLocation.id));

      await actor.attemptsTo(
        RegisterMovement.of({
          type: 'ADJUSTMENT',
          locationId: defaultLocation.id,
          reason: REASON,
          items: [{ productId: wellStocked.productId, quantity: -1 }],
        }),
        Ensure.that(LastResponse.status(), equals(201)),
      );
      const movement = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        Ensure.that(
          movement,
          hasProperties({ status: 'CONFIRMED', type: 'ADJUSTMENT', reason: REASON }),
        ),
        Ensure.that(StockLevel.of(wellStocked.productId, defaultLocation.id), equals(before - 1)),
        Ensure.that(
          LatestKardexEntry.of(wellStocked.productId, defaultLocation.id),
          hasProperties({
            movementCode: movement.code,
            quantityBase: -1,
            balanceAfter: before - 1,
          }),
        ),
      );
    });

    it('an adjustment whose reason is too short is refused with 400', async () => {
      const { actor, defaultLocation, wellStocked } = scene;

      await actor.attemptsTo(
        Send.a({
          method: 'POST',
          path: '/movements',
          body: {
            type: 'ADJUSTMENT',
            locationId: defaultLocation.id,
            reason: 'abc',
            items: [{ productId: wellStocked.productId, quantity: 1, unit: 'BOTTLE' }],
          },
        }),
        Ensure.that(LastResponse.status(), equals(400)),
      );
    });

    it('an adjustment that would leave the stock below zero answers 400 and changes nothing', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const before = await actor.answer(StockLevel.of(wellStocked.productId, defaultLocation.id));

      await actor.attemptsTo(
        OpenADraft.of({
          type: 'ADJUSTMENT',
          locationId: defaultLocation.id,
          reason: REASON,
          items: [{ productId: wellStocked.productId, quantity: -(before + 1) }],
        }),
        ConfirmTheMovement(),
        Ensure.that(LastResponse.status(), equals(400)),
        Ensure.that(StockLevel.of(wellStocked.productId, defaultLocation.id), equals(before)),
      );
    });
  },
);
