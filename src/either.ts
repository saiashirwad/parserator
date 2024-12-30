export type Either<R, L> = Left<L, R> | Right<R, L>

export class Left<L, R = never> {
	readonly _tag = "Left"
	constructor(public readonly left: L) {}
	*[Symbol.iterator](): Generator<Either<R, L>, R, any> {
		return yield this
	}
}

export class Right<R, L> {
	readonly _tag = "Right"
	constructor(public readonly right: R) {}
	*[Symbol.iterator](): Generator<Either<R, L>, R, any> {
		return yield this
	}
}

// export class GenEither<R, L> {
// 	constructor(readonly op: Either<R, L>) {}

// 	*[Symbol.iterator](): Generator<GenEither<R, L>, R, any> {
// 		return yield this
// 	}
// }

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

	gen<R, L>(
		f: () => Generator<Either<R, L>, R, any>,
	): Either<R, L> {
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
	},
}

function lol(e: Either<number, string>) {
	if (Either.isLeft(e)) {
		return e.left
	}
	console.log(e.right)
}

const aaa: Either<number, string> = Either.left<
	string,
	number
>("error message")

const bbb: Either<number, string> = Either.right<
	number,
	string
>(2)

const rip = Either.gen(function* () {
	const a = yield* aaa
	const b = yield* bbb
	return a + b
})

console.log(rip)
