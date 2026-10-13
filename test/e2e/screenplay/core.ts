/**
 * The Screenplay pattern in the shape Serenity/JS gives it (Actor, Ability,
 * Interaction, Task, Question, Ensure), small enough to live with the suite:
 * the API repo runs on Vitest + Chai and takes no new test dependencies.
 */

/** Something an actor can do: call an API, remember a value. */
export interface Ability {}

/** A class by its prototype, so abilities may keep their constructors private. */
type AbilityType<A extends Ability> = Function & { prototype: A };

/** Anything an actor attempts: an interaction or a task made of them. */
export interface Activity {
  readonly description: string;
  performAs(actor: Actor): Promise<void>;
}

/** Something an actor can find out about the system. */
export interface Question<T> {
  readonly description: string;
  answeredBy(actor: Actor): Promise<T>;
}

export type Answerable<T> = T | Question<T>;

const isQuestion = <T>(value: Answerable<T>): value is Question<T> =>
  typeof value === 'object' && value !== null && 'answeredBy' in value;

export class Actor {
  private readonly abilities = new Map<Function, Ability>();
  /** What the actor did, in order: the report a failed expectation prints. */
  readonly journal: string[] = [];

  constructor(readonly name: string) {}

  whoCan(...abilities: Ability[]): this {
    for (const ability of abilities) this.abilities.set(ability.constructor, ability);
    return this;
  }

  abilityTo<A extends Ability>(type: AbilityType<A>): A {
    const ability = this.abilities.get(type);
    if (!ability) throw new Error(`${this.name} cannot ${type.name}: the ability was never given`);
    return ability as A;
  }

  async attemptsTo(...activities: Activity[]): Promise<void> {
    for (const activity of activities) {
      this.journal.push(activity.description.replace('#actor', this.name));
      await activity.performAs(this);
    }
  }

  async answer<T>(answerable: Answerable<T>): Promise<T> {
    return isQuestion(answerable) ? answerable.answeredBy(this) : answerable;
  }
}

export const Interaction = {
  where: (description: string, perform: (actor: Actor) => Promise<void>): Activity => ({
    description,
    performAs: perform,
  }),
};

export const Task = {
  where: (description: string, ...activities: Activity[]): Activity => ({
    description,
    performAs: (actor) => actor.attemptsTo(...activities),
  }),
};

export const Question = {
  about: <T>(description: string, answer: (actor: Actor) => Promise<T>): Question<T> => ({
    description,
    answeredBy: answer,
  }),
};

/**
 * `Ensure.that(question, expectation)`: the expectation is a Chai assertion run
 * on the answer, so the failure reads with the question's own description.
 */
export const Ensure = {
  that: <T>(answerable: Answerable<T>, expectation: (actual: T, label: string) => unknown) =>
    Interaction.where(
      `#actor ensures that ${isQuestion(answerable) ? answerable.description : String(answerable)}`,
      async (actor) => {
        expectation(await actor.answer(answerable), describe(answerable));
      },
    ),
};

const describe = <T>(answerable: Answerable<T>) =>
  isQuestion(answerable) ? answerable.description : 'the value';
