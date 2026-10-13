import { afterEach, beforeAll, describe, it } from 'vitest';
import { Ensure } from './screenplay/core';
import { equals, hasProperties, startsWith } from './screenplay/expectations';
import { LastResponse, LatestKardexEntry, StockLevel, TheMovement } from './screenplay/questions';
import { OpenADraft, ConfirmTheMovement, RegisterMovement, Send } from './screenplay/tasks';
import { environment, SCENARIO_TIMEOUT_MS, HOOK_TIMEOUT_MS } from './support/environment';
import { cleanUp, PRODUCT_SLOT, type Scene, setTheScene } from './support/stage';

describe.skipIf(!environment.shouldRun)(
  'RF-15 E2E - Register an outbound movement',
  { timeout: SCENARIO_TIMEOUT_MS },
  () => {
    let scene: Scene;

    beforeAll(async () => {
      scene = await setTheScene(PRODUCT_SLOT.rf15);
    }, HOOK_TIMEOUT_MS);

    afterEach(() => cleanUp(scene), HOOK_TIMEOUT_MS);

    it('a confirmed outbound lowers the stock and is written to the kardex', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const before = await actor.answer(StockLevel.of(wellStocked.productId, defaultLocation.id));

      await actor.attemptsTo(
        RegisterMovement.of({
          type: 'OUTBOUND',
          locationId: defaultLocation.id,
          items: [{ productId: wellStocked.productId, quantity: 2 }],
        }),
        Ensure.that(LastResponse.status(), equals(201)),
      );
      const movement = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        Ensure.that(movement.status, equals('CONFIRMED')),
        Ensure.that(movement.code, startsWith('MOV-')),
        Ensure.that(
          movement.items.map((item) => item.quantityBase),
          equals([-2]),
        ),
        Ensure.that(StockLevel.of(wellStocked.productId, defaultLocation.id), equals(before - 2)),
        Ensure.that(
          LatestKardexEntry.of(wellStocked.productId, defaultLocation.id),
          hasProperties({
            movementCode: movement.code,
            quantityBase: -2,
            balanceAfter: before - 2,
          }),
        ),
      );
    });

    it('an outbound beyond the stock on hand answers 400 and nothing leaves', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const before = await actor.answer(StockLevel.of(wellStocked.productId, defaultLocation.id));

      await actor.attemptsTo(
        OpenADraft.of({
          type: 'OUTBOUND',
          locationId: defaultLocation.id,
          items: [{ productId: wellStocked.productId, quantity: before + 1 }],
        }),
        ConfirmTheMovement(),
        Ensure.that(LastResponse.status(), equals(400)),
        Ensure.that(StockLevel.of(wellStocked.productId, defaultLocation.id), equals(before)),
      );
      await actor.attemptsTo(
        Ensure.that((await actor.answer(TheMovement.asStored())).status, equals('DRAFT')),
      );
    });

    it('an outbound sent without signing in answers 401', async () => {
      const { actor, wellStocked } = scene;

      await actor.attemptsTo(
        Send.a({
          method: 'POST',
          path: '/movements',
          body: {
            type: 'OUTBOUND',
            items: [{ productId: wellStocked.productId, quantity: 1, unit: 'BOTTLE' }],
          },
          authenticated: false,
        }),
        Ensure.that(LastResponse.status(), equals(401)),
      );
    });
  },
);
