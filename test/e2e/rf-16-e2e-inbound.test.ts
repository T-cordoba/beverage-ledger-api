import { afterEach, beforeAll, describe, it } from 'vitest';
import { Ensure } from './screenplay/core';
import { equals, hasProperties } from './screenplay/expectations';
import { LastResponse, LatestKardexEntry, StockLevel, TheMovement } from './screenplay/questions';
import { ConfirmTheMovement, RegisterMovement, Send } from './screenplay/tasks';
import { environment, SCENARIO_TIMEOUT_MS, HOOK_TIMEOUT_MS } from './support/environment';
import { cleanUp, PRODUCT_SLOT, type Scene, setTheScene } from './support/stage';

describe.skipIf(!environment.shouldRun)(
  'RF-16 E2E - Register an inbound movement',
  { timeout: SCENARIO_TIMEOUT_MS },
  () => {
    let scene: Scene;

    beforeAll(async () => {
      scene = await setTheScene(PRODUCT_SLOT.rf16);
    }, HOOK_TIMEOUT_MS);

    afterEach(() => cleanUp(scene), HOOK_TIMEOUT_MS);

    it('an inbound by the case raises the stock by the case size, in bottles', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const before = await actor.answer(StockLevel.of(wellStocked.productId, defaultLocation.id));

      await actor.attemptsTo(
        RegisterMovement.of({
          type: 'INBOUND',
          locationId: defaultLocation.id,
          items: [{ productId: wellStocked.productId, quantity: 1, unit: 'CASE' }],
        }),
        Ensure.that(LastResponse.status(), equals(201)),
      );
      const movement = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        Ensure.that(movement.status, equals('CONFIRMED')),
        Ensure.that(
          movement.items.map(({ quantity, unit, quantityBase }) => ({
            quantity,
            unit,
            quantityBase,
          })),
          equals([{ quantity: 1, unit: 'CASE', quantityBase: wellStocked.caseSize }]),
        ),
        Ensure.that(
          StockLevel.of(wellStocked.productId, defaultLocation.id),
          equals(before + wellStocked.caseSize),
        ),
        Ensure.that(
          LatestKardexEntry.of(wellStocked.productId, defaultLocation.id),
          hasProperties({ movementCode: movement.code, quantityBase: wellStocked.caseSize }),
        ),
      );
    });

    it('confirming the same inbound twice answers 409 and adds the stock once', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const before = await actor.answer(StockLevel.of(wellStocked.productId, defaultLocation.id));

      await actor.attemptsTo(
        RegisterMovement.of({
          type: 'INBOUND',
          locationId: defaultLocation.id,
          items: [{ productId: wellStocked.productId, quantity: 3 }],
        }),
        ConfirmTheMovement(),
        Ensure.that(LastResponse.status(), equals(409)),
        Ensure.that(StockLevel.of(wellStocked.productId, defaultLocation.id), equals(before + 3)),
      );
    });

    it('an inbound with a negative quantity is refused with 400 before any draft exists', async () => {
      const { actor, defaultLocation, wellStocked } = scene;

      await actor.attemptsTo(
        Send.a({
          method: 'POST',
          path: '/movements',
          body: {
            type: 'INBOUND',
            locationId: defaultLocation.id,
            items: [{ productId: wellStocked.productId, quantity: -5, unit: 'BOTTLE' }],
          },
        }),
        Ensure.that(LastResponse.status(), equals(400)),
      );
    });
  },
);
