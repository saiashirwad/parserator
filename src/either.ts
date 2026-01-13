export type Either<R, L> = Left<L, R> | Right<R, L>;

export class Left<L, R = never> {
  readonly _tag = "Left";
  constructor(public readonly left: L) {}
  *[Symbol.iterator](): Generator<Either<R, L>, R, any> {
    return yield this;
  }
}

export class Right<R, L = any> {
  readonly _tag = "Right";
  constructor(public readonly right: R) {}
  *[Symbol.iterator](): Generator<Either<R, L>, R, any> {
    return yield this;
  }
}

// Pre-allocated common values for performance
const VOID_RIGHT = new Right<void, never>(undefined);
const TRUE_RIGHT = new Right<boolean, never>(true);
const FALSE_RIGHT = new Right<boolean, never>(false);
const EMPTY_STRING_RIGHT = new Right<string, never>("");
const EMPTY_ARRAY_RIGHT = new Right<any[], never>([]);

export const Either = {
  left<L, R = never>(l: L): Either<R, L> {
    return new Left(l);
  },

  right<R, L = never>(r: R): Either<R, L> {
    // Fast path for common values
    if (r === undefined) return VOID_RIGHT as any;
    if (r === true) return TRUE_RIGHT as any;
    if (r === false) return FALSE_RIGHT as any;
    if (r === "") return EMPTY_STRING_RIGHT as any;
    return new Right(r);
  },

  isLeft<R, L>(either: Either<R, L>): either is Left<L, R> {
    return either._tag === "Left";
  },

  isRight<R, L>(either: Either<R, L>): either is Right<R, L> {
    return either._tag === "Right";
  },

  match<R, L, T>(onLeft: (left: L) => T, onRight: (right: R) => T) {
    return (either: Either<R, L>): T => {
      if (either._tag === "Left") {
        return onLeft(either.left);
      }
      return onRight(either.right);
    };
  },

  gen<R, L>(f: () => Generator<Either<any, L>, R, any>): Either<R, L> {
    const iterator = f();
    let current = iterator.next();

    while (!current.done) {
      const either = current.value;
      if (either._tag === "Left") {
        return either;
      }
      current = iterator.next(either.right);
    }

    return Either.right(current.value);
  }
};
