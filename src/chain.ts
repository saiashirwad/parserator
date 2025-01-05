// import { Either } from "./either"
// import { Parser } from "./parser"

// export type Chain<Ctx = {}> = {
// 	<T, U>(parser: Parser<T, Ctx>, fn1: (value: T) => Parser<U>): Parser<U>
// 	<T1, T2, T3>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 	): Parser<T3>
// 	<T1, T2, T3, T4>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 	): Parser<T4>
// 	<T1, T2, T3, T4, T5>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 		fn4: (value: T4) => Parser<T5, Ctx>,
// 	): Parser<T5>
// 	<T1, T2, T3, T4, T5, T6>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 		fn4: (value: T4) => Parser<T5, Ctx>,
// 		fn5: (value: T5) => Parser<T6, Ctx>,
// 	): Parser<T6>
// 	<T1, T2, T3, T4, T5, T6, T7>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 		fn4: (value: T4) => Parser<T5, Ctx>,
// 		fn5: (value: T5) => Parser<T6, Ctx>,
// 		fn6: (value: T6) => Parser<T7, Ctx>,
// 	): Parser<T7>
// 	<T1, T2, T3, T4, T5, T6, T7, T8>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 		fn4: (value: T4) => Parser<T5, Ctx>,
// 		fn5: (value: T5) => Parser<T6, Ctx>,
// 		fn6: (value: T6) => Parser<T7, Ctx>,
// 		fn7: (value: T7) => Parser<T8, Ctx>,
// 	): Parser<T8>
// 	<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 		fn4: (value: T4) => Parser<T5, Ctx>,
// 		fn5: (value: T5) => Parser<T6, Ctx>,
// 		fn6: (value: T6) => Parser<T7, Ctx>,
// 		fn7: (value: T7) => Parser<T8, Ctx>,
// 		fn8: (value: T8) => Parser<T9, Ctx>,
// 	): Parser<T9>
// 	<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
// 		parser: Parser<T1, Ctx>,
// 		fn1: (value: T1) => Parser<T2, Ctx>,
// 		fn2: (value: T2) => Parser<T3, Ctx>,
// 		fn3: (value: T3) => Parser<T4, Ctx>,
// 		fn4: (value: T4) => Parser<T5, Ctx>,
// 		fn5: (value: T5) => Parser<T6, Ctx>,
// 		fn6: (value: T6) => Parser<T7, Ctx>,
// 		fn7: (value: T7) => Parser<T8, Ctx>,
// 		fn8: (value: T8) => Parser<T9, Ctx>,
// 		fn9: (value: T9) => Parser<T10, Ctx>,
// 	): Parser<T10>
// }

// export const chain = <Ctx = {}>(
// 	parser: Parser<any, Ctx>,
// 	...fns: Array<(value: any) => Parser<any, Ctx>>
// ): Chain<Ctx> => {
// 	return new Parser<any, Ctx>((state) => {
// 		let result = parser.run(state)
// 		for (const fn of fns) {
// 			const { result: parserResult, state: newState } = result
// 			if (Either.isLeft(parserResult)) {
// 				return Parser.fail(parserResult.left, newState)
// 			}
// 			const value = parserResult.right
// 			result = fn(value).run(newState)
// 		}
// 		return result
// 	}) as any
// }
