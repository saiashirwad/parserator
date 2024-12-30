export type Either<R, L> = Left<L, R> | Right<R, L>

export class Left<L, R = never> {
	readonly _tag = "Left"
	constructor(public readonly left: L) {}
	*[Symbol.iterator](): Generator<Left<L, R>, L, any> {
		return yield this
	}
}

export class Right<R, L> {
	readonly _tag = "Right"
	constructor(public readonly right: R) {}
	*[Symbol.iterator](): Generator<Right<R, L>, R, any> {
		return yield this
	}
}

export const Either = {
	left<L, R = never>(l: L): Left<L, R> {
		return new Left(l)
	},

	right<R, L = never>(r: R): Right<R, L> {
		return new Right(r)
	},

	isLeft<R, L>(either: Either<R, L>): either is Left<L, R> {
		return either._tag === "Left"
	},

	isRight<R, L>(
		either: Either<R, L>,
	): either is Right<R, L> {
		return either._tag === "Right"
	},

	match<R, L, RResult, LResult>(
		either: Either<R, L>,
		patterns: {
			onLeft: (left: L) => LResult
			onRight: (right: R) => RResult
		},
	): LResult | RResult {
		if (Either.isLeft(either)) {
			return patterns.onLeft(either.left)
		}
		return patterns.onRight(either.right)
	},
}

function lol(e: Either<number, string>) {
	if (Either.isLeft(e)) {
		return e.left
	}
	console.log(e.right)
}

const a: Either<string, number> = Either.left(2)

const result = Either.match(a, {
	onLeft: (left) => left,
	onRight: (right) => right,
})
