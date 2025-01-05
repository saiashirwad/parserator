import { Either } from "./either"
import { Parser } from "./parser"

export type Chain = {
	<T, U>(parser: Parser<T>, fn1: (value: T) => Parser<U>): Parser<U>
	<T1, T2, T3>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
	): Parser<T3>
	<T1, T2, T3, T4>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
	): Parser<T4>
	<T1, T2, T3, T4, T5>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
		fn4: (value: T4) => Parser<T5>,
	): Parser<T5>
	<T1, T2, T3, T4, T5, T6>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
		fn4: (value: T4) => Parser<T5>,
		fn5: (value: T5) => Parser<T6>,
	): Parser<T6>
	<T1, T2, T3, T4, T5, T6, T7>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
		fn4: (value: T4) => Parser<T5>,
		fn5: (value: T5) => Parser<T6>,
		fn6: (value: T6) => Parser<T7>,
	): Parser<T7>
	<T1, T2, T3, T4, T5, T6, T7, T8>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
		fn4: (value: T4) => Parser<T5>,
		fn5: (value: T5) => Parser<T6>,
		fn6: (value: T6) => Parser<T7>,
		fn7: (value: T7) => Parser<T8>,
	): Parser<T8>
	<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
		fn4: (value: T4) => Parser<T5>,
		fn5: (value: T5) => Parser<T6>,
		fn6: (value: T6) => Parser<T7>,
		fn7: (value: T7) => Parser<T8>,
		fn8: (value: T8) => Parser<T9>,
	): Parser<T9>
	<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
		parser: Parser<T1>,
		fn1: (value: T1) => Parser<T2>,
		fn2: (value: T2) => Parser<T3>,
		fn3: (value: T3) => Parser<T4>,
		fn4: (value: T4) => Parser<T5>,
		fn5: (value: T5) => Parser<T6>,
		fn6: (value: T6) => Parser<T7>,
		fn7: (value: T7) => Parser<T8>,
		fn8: (value: T8) => Parser<T9>,
		fn9: (value: T9) => Parser<T10>,
	): Parser<T10>
}

export const chain: Chain = (
	parser: Parser<any>,
	...fns: Array<(value: any) => Parser<any>>
): Parser<any> => {
	return new Parser((state) => {
		let result = parser.run(state)
		for (const fn of fns) {
			const { result: parserResult, state: newState } = result
			if (Either.isLeft(parserResult)) {
				return Parser.fail(parserResult.left, newState)
			}
			const value = parserResult.right
			result = fn(value).run(newState)
		}
		return result
	})
}
