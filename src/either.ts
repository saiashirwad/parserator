export type Either<R, L> = Left<L, R> | Right<R, L>

export class Left<L, R = never> {
  readonly _tag = "Left"
  constructor(public readonly left: L) {}
  *[Symbol.iterator](): Generator<Either<R, L>, R, any> {
    return yield this
  }
}

export class Right<R, L = any> {
  readonly _tag = "Right"
  constructor(public readonly right: R) {}
  *[Symbol.iterator](): Generator<Either<R, L>, R, any> {
    return yield this
  }
}

export const Either = {
  left<L, R = never>(l: L): Either<R, L> {
    return new Left(l)
  },

  right<R, L = never>(r: R): Either<R, L> {
    return new Right(r)
  },

  isLeft<R, L>(either: Either<R, L>): either is Left<L, R> {
    return either._tag === "Left"
  },

  isRight<R, L>(either: Either<R, L>): either is Right<R, L> {
    return either._tag === "Right"
  },

  match<R, L, T>(onLeft: (left: L) => T, onRight: (right: R) => T) {
    return (either: Either<R, L>): T => {
      if (Either.isLeft(either)) {
        return onLeft(either.left)
      }
      return onRight(either.right)
    }
  },

  gen<R, L>(f: () => Generator<Either<any, L>, R, any>): Either<R, L> {
    const iterator = f()
    let current = iterator.next()

    while (!current.done) {
      const either = current.value
      if (Either.isLeft(either)) {
        return either
      }
      current = iterator.next(either.right)
    }

    return Either.right(current.value)
  }
}
