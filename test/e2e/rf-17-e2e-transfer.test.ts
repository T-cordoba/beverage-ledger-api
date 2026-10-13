import { afterEach, beforeAll, describe, it } from 'vitest';
import { Ensure } from './screenplay/core';
import { equals } from './screenplay/expectations';
import { LastResponse, StockLevel, TheMovement } from './screenplay/questions';
import { ConfirmTheMovement, OpenADraft, RegisterMovement, Send } from './screenplay/tasks';
import { environment, SCENARIO_TIMEOUT_MS, HOOK_TIMEOUT_MS } from './support/environment';
import { cleanUp, PRODUCT_SLOT, type Location, type Scene, setTheScene } from './support/stage';

describe.skipIf(!environment.shouldRun)(
  'RF-17 E2E - Transfer stock between locations',
  { timeout: SCENARIO_TIMEOUT_MS },
  () => {
    let scene: Scene;
    let destination: Location;

    beforeAll(async () => {
      scene = await setTheScene(PRODUCT_SLOT.rf17);
      if (!scene.otherLocation) {
        throw new Error('RF-17 needs a second location besides the default one (POST /locations)');
      }
      destination = scene.otherLocation;
    }, HOOK_TIMEOUT_MS);

    afterEach(() => cleanUp(scene), HOOK_TIMEOUT_MS);

    it('a confirmed transfer moves the bottles to the destination and keeps the total', async () => {
      const { actor, defaultLocation: origin, wellStocked } = scene;
      const atOrigin = StockLevel.of(wellStocked.productId, origin.id);
      const atDestination = StockLevel.of(wellStocked.productId, destination.id);
      const [originBefore, destinationBefore] = [
        await actor.answer(atOrigin),
        await actor.answer(atDestination),
      ];

      await actor.attemptsTo(
        RegisterMovement.of({
          type: 'TRANSFER',
          locationId: origin.id,
          destinationLocationId: destination.id,
          items: [{ productId: wellStocked.productId, quantity: 3 }],
        }),
        Ensure.that(LastResponse.status(), equals(201)),
      );
      const movement = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        Ensure.that(movement.status, equals('CONFIRMED')),
        // One line per side, signed, each with its own location.
        Ensure.that(
          movement.items
            .map(({ locationId, quantityBase }) => ({ locationId, quantityBase }))
            .sort((a, b) => a.quantityBase - b.quantityBase),
          equals([
            { locationId: origin.id, quantityBase: -3 },
            { locationId: destination.id, quantityBase: 3 },
          ]),
        ),
        Ensure.that(atOrigin, equals(originBefore - 3)),
        Ensure.that(atDestination, equals(destinationBefore + 3)),
      );
    });

    it('a transfer whose destination is its own origin is refused with 400', async () => {
      const { actor, defaultLocation, wellStocked } = scene;

      await actor.attemptsTo(
        Send.a({
          method: 'POST',
          path: '/movements',
          body: {
            type: 'TRANSFER',
            locationId: defaultLocation.id,
            destinationLocationId: defaultLocation.id,
            items: [{ productId: wellStocked.productId, quantity: 1, unit: 'BOTTLE' }],
          },
        }),
        Ensure.that(LastResponse.status(), equals(400)),
      );
    });

    it('a transfer beyond what the origin holds answers 400 and moves nothing', async () => {
      const { actor, defaultLocation: origin, wellStocked } = scene;
      const atOrigin = StockLevel.of(wellStocked.productId, origin.id);
      const atDestination = StockLevel.of(wellStocked.productId, destination.id);
      const [originBefore, destinationBefore] = [
        await actor.answer(atOrigin),
        await actor.answer(atDestination),
      ];

      await actor.attemptsTo(
        OpenADraft.of({
          type: 'TRANSFER',
          locationId: origin.id,
          destinationLocationId: destination.id,
          items: [{ productId: wellStocked.productId, quantity: originBefore + 1 }],
        }),
        ConfirmTheMovement(),
        Ensure.that(LastResponse.status(), equals(400)),
        Ensure.that(atOrigin, equals(originBefore)),
        Ensure.that(atDestination, equals(destinationBefore)),
      );
    });
  },
);
