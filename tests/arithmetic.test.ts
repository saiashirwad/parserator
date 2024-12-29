import { describe, expect, test } from "bun:test"
import {
	char,
	lookAhead,
	skipSpaces,
	Parser,
	or,
	many1,
	between,
	optional,
	regex,
} from "../src"

type Op =
	| "add"
	| "sub"
	| "mul"
	| "div"
	| "mod"
	| "lt"
	| "lte"
	| "gt"
	| "gte"
	| "eq"

type Expr =
	| { type: "number"; value: number }
	| { type: "op"; op: Op; left: Expr; right: Expr }
