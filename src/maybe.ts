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

export class GenMaybe<A> {
	constructor(readonly op: Maybe<A>) {}

	*[Symbol.iterator](): Generator<GenMaybe<A>, A, any> {
		return yield this
	}
}

export const Maybe = {
	none<A = never>(): Maybe<A> {
		return new None()
	},

	some<A>(value: A) {
		return new Some(value)
	},

	isNone<A>(maybe: Maybe<A>): maybe is None {
		return maybe._tag === "None"
	},

	isSome<A>(maybe: Maybe<A>): maybe is Some<A> {
		return maybe._tag === "Some"
	},

	match<A, B>(
		maybe: Maybe<A>,
		patterns: {
			onNone: () => B
			onSome: (value: A) => B
		},
	): B {
		if (Maybe.isNone(maybe)) {
			return patterns.onNone()
		}
		return patterns.onSome(maybe.value)
	},

	of<A>(value: Maybe<A>): GenMaybe<A> {
		return new GenMaybe(value)
	},

	gen<T>(
		f: (
			adapter: <A>(m: Maybe<A>) => GenMaybe<A>,
		) => Generator<GenMaybe<any>, T, any>,
	): Maybe<T> {
		const adapter = <A>(m: Maybe<A>) => new GenMaybe(m)
		const iterator = f(adapter)
		let current = iterator.next()

		while (!current.done) {
			const maybe = current.value.op
			if (Maybe.isNone(maybe)) {
				return maybe
			}
			current = iterator.next(maybe.value)
		}

		return Maybe.some(current.value)
	},
}
