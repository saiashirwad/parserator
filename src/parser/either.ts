export type Either<R, L> = Left<L> | Right<R>

export class Left<L> {
	readonly _tag = "Left"
	constructor(public readonly left: L) {}
}

export class Right<R> {
	readonly _tag = "Right"
	constructor(public readonly right: R) {}
}

export const Either = {
	left<L, R = never>(l: L): Either<R, L> {
		return new Left(l)
	},

	right<R, L = never>(r: R): Either<R, L> {
		return new Right(r)
	},

	isLeft<R, L>(either: Either<R, L>): either is Left<L> {
		return either._tag === "Left"
	},

	isRight<R, L>(either: Either<R, L>): either is Right<R> {
		return either._tag === "Right"
	},

	match<R, L, B>(
		either: Either<R, L>,
		patterns: {
			onLeft: (left: L) => B
			onRight: (right: R) => B
		},
	): B {
		if (Either.isLeft(either)) {
			return patterns.onLeft(either.left)
		}
		return patterns.onRight(either.right)
	},
}
