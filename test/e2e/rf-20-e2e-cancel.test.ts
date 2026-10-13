import { afterEach, beforeAll, describe, it } from 'vitest';
import { Ensure } from './screenplay/core';
import { equals, hasProperties, isTruthy } from './screenplay/expectations';
import { LastResponse, StockLevel, TheMovement } from './screenplay/questions';
import { CancelTheMovement, RegisterMovement } from './screenplay/tasks';
import { environment, SCENARIO_TIMEOUT_MS, HOOK_TIMEOUT_MS } from './support/environment';
import { cleanUp, PRODUCT_SLOT, type Scene, setTheScene } from './support/stage';

describe.skipIf(!environment.shouldRun)(
  'RF-20 E2E - Void a confirmed movement',
  { timeout: SCENARIO_TIMEOUT_MS },
  () => {
    let scene: Scene;

    beforeAll(async () => {
      scene = await setTheScene(PRODUCT_SLOT.rf20);
    }, HOOK_TIMEOUT_MS);

    afterEach(() => cleanUp(scene), HOOK_TIMEOUT_MS);

    const registerAnOutbound = (bottles: number) =>
      RegisterMovement.of({
        type: 'OUTBOUND',
        locationId: scene.defaultLocation.id,
        items: [{ productId: scene.wellStocked.productId, quantity: bottles }],
      });

    it('voiding gives the stock back and keeps the movement, marked cancelled, with its code', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const stock = StockLevel.of(wellStocked.productId, defaultLocation.id);
      const before = await actor.answer(stock);

      await actor.attemptsTo(registerAnOutbound(2), Ensure.that(stock, equals(before - 2)));
      const { code } = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        CancelTheMovement.withReason('Registered by mistake (E2E)'),
        Ensure.that(LastResponse.status(), equals(201)),
        Ensure.that(stock, equals(before)),
      );
      const voided = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        Ensure.that(voided, hasProperties({ status: 'CANCELLED', code })),
        Ensure.that(voided.cancelledAt, isTruthy()),
        // The ledger is not rewritten: the voided movement keeps its original line.
        Ensure.that(
          voided.items.map((item) => item.quantityBase),
          equals([-2]),
        ),
      );
    });

    it('voiding the same movement twice answers 409 and gives the stock back once', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const stock = StockLevel.of(wellStocked.productId, defaultLocation.id);
      const before = await actor.answer(stock);

      await actor.attemptsTo(
        registerAnOutbound(1),
        CancelTheMovement.withReason('First void (E2E)'),
        CancelTheMovement.withReason('Second void (E2E)'),
        Ensure.that(LastResponse.status(), equals(409)),
        Ensure.that(stock, equals(before)),
      );
    });

    it('a void without a reason answers 400 and the movement stays confirmed', async () => {
      const { actor, defaultLocation, wellStocked } = scene;
      const stock = StockLevel.of(wellStocked.productId, defaultLocation.id);
      const before = await actor.answer(stock);

      await actor.attemptsTo(
        registerAnOutbound(1),
        CancelTheMovement.withReason(undefined),
        Ensure.that(LastResponse.status(), equals(400)),
        Ensure.that(stock, equals(before - 1)),
      );
      await actor.attemptsTo(
        Ensure.that((await actor.answer(TheMovement.asStored())).status, equals('CONFIRMED')),
      );
    });
  },
);
