export class Either<R, L> {
	readonly _tag: "Left" | "Right"
	public value: L | R

	private constructor(tag: "Left", value: L)
	private constructor(tag: "Right", value: R)
	private constructor(tag: "Left" | "Right", value: L | R) {
		this._tag = tag
		this.value = value
	}

	static left<L, R = never>(left: L): Either<R, L> {
		return new Either("Left", left)
	}

	static right<R, L = never>(right: R): Either<R, L> {
		return new Either("Right", right)
	}

	static isLeft<R, L>(
		either: Either<R, L>,
	): either is Either<R, L> & { _tag: "Left" } {
		return either._tag === "Left"
	}

	static isRight<R, L>(
		either: Either<R, L>,
	): either is Either<R, L> & { _tag: "Right" } {
		return either._tag === "Right"
	}

	static match<R, L, B>(
		either: Either<R, L>,
		patterns: {
			onLeft: (left: L) => B
			onRight: (right: R) => B
		},
	): B {
		return Either.isLeft(either)
			? patterns.onLeft(either.value as L)
			: patterns.onRight(either.value as R)
	}

	*[Symbol.iterator](): Generator<Either<R, L>, R, any> {
		return yield this
	}

	static gen<R, L>(
		f: () => Generator<Either<R, L>, R, any>,
	): Either<R, L> {
		const iterator = f()
		let current = iterator.next()

		while (!current.done) {
			const either = current.value
			if (Either.isLeft(either)) {
				return either
			}
			current = iterator.next(either.value as R)
		}

		return Either.right(current.value)
	}
}

const ea: Either<number, string> = Either.gen(function* () {
	const a: number = yield* Either.right(5)
	const b: number = yield* Either.right(3)
	return a + b
})

const eb: Either<number, string> = Either.gen(function* () {
	const a = yield* ea
	const aa = yield* ea
	yield* Either.left("error")
	return a + aa
})
