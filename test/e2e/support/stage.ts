import { CallAnApi, TakeNotes } from '../screenplay/abilities';
import { Actor } from '../screenplay/core';
import { Authenticate, VoidWhatWasLeftBehind } from '../screenplay/tasks';
import { environment } from './environment';

export interface Location {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface StockedProduct {
  productId: string;
  productName: string;
  quantityBase: number;
  caseSize: number;
}

/** What the scenarios need from the data already in the database, found rather than assumed. */
export interface Scene {
  actor: Actor;
  defaultLocation: Location;
  otherLocation: Location | undefined;
  /** A product with plenty of bottles at the default location, so taking a few never fails. */
  wellStocked: StockedProduct;
}

/**
 * Vitest runs the files in parallel, and two files moving the same product
 * would read each other's stock changes. Each file therefore owns a disjoint
 * share of the catalogue, keyed on the product id. Ranking by stock instead
 * looked equivalent but is not: the files start at different moments, by then
 * another file has moved stock, and two of them land on the same product.
 */
export const PRODUCT_SLOT = { rf15: 0, rf16: 1, rf17: 2, rf18: 3, rf20: 4, rf21: 5 } as const;

const SLOTS = Object.keys(PRODUCT_SLOT).length;

const slotOf = (productId: string) =>
  Number.parseInt(productId.replace(/-/g, '').slice(-8), 16) % SLOTS;

/** Camila, the warehouse manager of the frontend suite, signed in against the API. */
export async function setTheScene(slot: number): Promise<Scene> {
  const actor = new Actor('Camila').whoCan(
    CallAnApi.at(environment.apiUrl),
    TakeNotes.usingAnEmptyNotepad(),
  );
  await actor.attemptsTo(Authenticate.withTheTestAccount());

  const api = CallAnApi.as(actor);
  const { data: locations } = await api.read<{ data: Location[] }>('/locations');
  const defaultLocation = locations.find((location) => location.isDefault);
  if (!defaultLocation) throw new Error('The organization has no default location');

  const levels: StockedProduct[] = [];
  for (let page = 1, pageCount = 1; page <= pageCount; page += 1) {
    const { data, meta } = await api.read<{ data: StockedProduct[]; meta: { pageCount: number } }>(
      '/stock',
      { locationId: defaultLocation.id, page, pageSize: 100 },
    );
    levels.push(...data);
    pageCount = meta.pageCount;
  }

  // Only this file ever writes to its share, so the pick cannot shift under it.
  const [wellStocked] = levels
    .filter((level) => slotOf(level.productId) === slot && level.quantityBase >= 10)
    .sort((a, b) => b.quantityBase - a.quantityBase || a.productId.localeCompare(b.productId));
  if (!wellStocked) {
    throw new Error(
      `No product of share ${slot} holds 10+ bottles at the default location; seed demo data`,
    );
  }

  return {
    actor,
    defaultLocation,
    otherLocation: locations.find((location) => !location.isDefault),
    wellStocked,
  };
}

export const cleanUp = (scene: Scene | undefined) =>
  scene?.actor.attemptsTo(VoidWhatWasLeftBehind());
