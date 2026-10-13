import { afterAll, beforeAll, describe, it } from 'vitest';
import { Ensure } from './screenplay/core';
import { doesNotEqual, equals, startsWith } from './screenplay/expectations';
import { LastResponse, TheMovement } from './screenplay/questions';
import { DownloadTheReceipt, RegisterMovement } from './screenplay/tasks';
import { environment, SCENARIO_TIMEOUT_MS, HOOK_TIMEOUT_MS } from './support/environment';
import { cleanUp, PRODUCT_SLOT, type Scene, setTheScene } from './support/stage';

/** A well-formed UUID that names no movement. */
const UNKNOWN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe.skipIf(!environment.shouldRun)(
  'RF-21 E2E - Download the movement voucher',
  { timeout: SCENARIO_TIMEOUT_MS },
  () => {
    let scene: Scene;

    beforeAll(async () => {
      scene = await setTheScene(PRODUCT_SLOT.rf21);
      await scene.actor.attemptsTo(
        RegisterMovement.of({
          type: 'OUTBOUND',
          locationId: scene.defaultLocation.id,
          items: [{ productId: scene.wellStocked.productId, quantity: 1 }],
        }),
      );
    }, HOOK_TIMEOUT_MS);

    // Every scenario reads the same confirmed movement, voided once at the end.
    afterAll(() => cleanUp(scene), HOOK_TIMEOUT_MS);

    it('the voucher of a confirmed movement downloads as a PDF named after its code', async () => {
      const { actor } = scene;
      const { code } = await actor.answer(TheMovement.asStored());

      await actor.attemptsTo(
        DownloadTheReceipt.ofTheMovement(),
        Ensure.that(LastResponse.status(), equals(200)),
        Ensure.that(LastResponse.header('content-type'), startsWith('application/pdf')),
        Ensure.that(
          LastResponse.header('content-disposition'),
          equals(`attachment; filename="${code}.pdf"`),
        ),
        Ensure.that(LastResponse.signature(), equals('%PDF-')),
      );
    });

    it('the voucher of a movement that does not exist answers 404', async () => {
      await scene.actor.attemptsTo(
        DownloadTheReceipt.of(UNKNOWN_ID),
        Ensure.that(LastResponse.status(), equals(404)),
      );
    });

    it('the voucher requested without signing in answers 401 and carries no document', async () => {
      await scene.actor.attemptsTo(
        DownloadTheReceipt.ofTheMovement({ authenticated: false }),
        Ensure.that(LastResponse.status(), equals(401)),
        Ensure.that(LastResponse.signature(), doesNotEqual('%PDF-')),
      );
    });
  },
);
