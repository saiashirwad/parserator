export type Maybe<A> = None | Some<A>

export class None {
	readonly _tag = "None"
	constructor() {}
	*[Symbol.iterator](): Generator<None, never, never> {
		return yield this
	}
}

export class Some<A> {
	readonly _tag = "Some"
	constructor(public readonly value: A) {}
	*[Symbol.iterator](): Generator<Some<A>, A, never> {
		return yield this
	}
}

export const Maybe = {
	none<A = never>(): Maybe<A> {
		return new None()
	},

	some<A>(value: A): Maybe<A> {
		return new Some(value)
	},

	isNone<A>(maybe: Maybe<A>): maybe is None {
		return maybe._tag === "None"
	},

	isSome<A>(maybe: Maybe<A>): maybe is Some<A> {
		return maybe._tag === "Some"
	},

	match<A, T>(
		maybe: Maybe<A>,
		patterns: {
			onNone: () => T
			onSome: (value: A) => T
		},
	): T {
		if (Maybe.isNone(maybe)) {
			return patterns.onNone()
		}
		return patterns.onSome(maybe.value)
	},

	gen<T>(f: () => Generator<Maybe<T>, T, any>): Maybe<T> {
		const iterator = f()
		let current = iterator.next()

		while (!current.done) {
			const maybe = current.value
			if (Maybe.isNone(maybe)) {
				return maybe
			}
			current = iterator.next(maybe.value)
		}

		return Maybe.some(current.value)
	},
}
