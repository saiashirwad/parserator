type Left<L> = { _tag: "Left"; value: L }
type Right<R> = { _tag: "Right"; value: R }

export class Either<R, L> {
	readonly _tag!: "Left" | "Right"
	readonly value!: L | R

	private constructor(tag: "Left", value: L)
	private constructor(tag: "Right", value: R)
	private constructor(tag: "Left" | "Right", value: L | R) {
		this._tag = tag
		this.value = value
	}

	static left<L, R = never>(
		left: L,
	): Either<R, L> & Left<L> {
		return new Either("Left", left) as Either<R, L> &
			Left<L>
	}

	static right<R, L = never>(
		right: R,
	): Either<R, L> & Right<R> {
		return new Either("Right", right) as Either<R, L> &
			Right<R>
	}

	static isLeft<R, L>(
		either: Either<R, L>,
	): either is Either<R, L> & Left<L> {
		return either._tag === "Left"
	}

	static isRight<R, L>(
		either: Either<R, L>,
	): either is Either<R, L> & Right<R> {
		return either._tag === "Right"
	}

	static match<R, L, B>(
		either: Either<R, L>,
		patterns: {
			onLeft: (left: L) => B
			onRight: (right: R) => B
		},
	): B {
		if (Either.isLeft(either)) {
			return patterns.onLeft(either.value)
		}
		return patterns.onRight(either.value as R)
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
			if (Either.isRight(either)) {
				current = iterator.next(either.value)
			}
		}

		return Either.right(current.value)
	}
}
