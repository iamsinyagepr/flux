// Package js reproduces the few JavaScript behaviours the Studio compiler's
// output depends on, so the Go port writes byte-for-byte what the original
// TypeScript compiler wrote: JS values and truthiness, Number → string,
// JSON.stringify of strings, UTF-16 lengths, JS whitespace, and objects that
// keep their keys in JS order.
package js

import (
	"math"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// Kind is a JS primitive type.
type Kind uint8

const (
	Undefined Kind = iota
	Null
	Boolean
	Number
	String
)

// Value is a JS primitive: what a Flux literal (or its absence) evaluates to.
type Value struct {
	kind Kind
	b    bool
	n    float64
	s    string
}

func UndefinedValue() Value       { return Value{} }
func NullValue() Value            { return Value{kind: Null} }
func BoolValue(b bool) Value      { return Value{kind: Boolean, b: b} }
func NumberValue(n float64) Value { return Value{kind: Number, n: n} }
func StringValue(s string) Value  { return Value{kind: String, s: s} }

func (v Value) Kind() Kind        { return v.kind }
func (v Value) IsUndefined() bool { return v.kind == Undefined }
func (v Value) IsNull() bool      { return v.kind == Null }
func (v Value) IsNullish() bool   { return v.kind == Undefined || v.kind == Null }
func (v Value) Bool() bool        { return v.b }
func (v Value) Num() float64      { return v.n }
func (v Value) Str() string       { return v.s }

// TypeOf is JS `typeof` ("object" for null).
func (v Value) TypeOf() string {
	switch v.kind {
	case Null:
		return "object"
	case Boolean:
		return "boolean"
	case Number:
		return "number"
	case String:
		return "string"
	}
	return "undefined"
}

// Truthy is JS truthiness: "", 0, -0, NaN, null, undefined and false are falsy.
func (v Value) Truthy() bool {
	switch v.kind {
	case Boolean:
		return v.b
	case Number:
		return v.n != 0 && !math.IsNaN(v.n)
	case String:
		return v.s != ""
	}
	return false
}

// String is JS String(value).
func (v Value) String() string {
	switch v.kind {
	case Null:
		return "null"
	case Boolean:
		if v.b {
			return "true"
		}
		return "false"
	case Number:
		return NumberString(v.n)
	case String:
		return v.s
	}
	return "undefined"
}

// StrictEquals is JS ===.
func StrictEquals(a, b Value) bool {
	if a.kind != b.kind {
		return false
	}
	switch a.kind {
	case Boolean:
		return a.b == b.b
	case Number:
		return a.n == b.n // NaN never equals itself; +0 equals -0
	case String:
		return a.s == b.s
	}
	return true
}

// NumberString is ECMAScript Number::toString(10): the shortest digits that
// round-trip, in plain notation from 1e-6 up to 1e21 and exponent notation
// outside it ("1e+21", "1e-7").
func NumberString(x float64) string {
	switch {
	case math.IsNaN(x):
		return "NaN"
	case x == 0:
		return "0"
	case x < 0:
		return "-" + NumberString(-x)
	case math.IsInf(x, 1):
		return "Infinity"
	}
	// d.ddddde±XX: the shortest round-trip digits, as JS chooses them.
	e := strconv.FormatFloat(x, 'e', -1, 64)
	mantissa, exponent, _ := strings.Cut(e, "e")
	digits := strings.Replace(mantissa, ".", "", 1)
	exp, _ := strconv.Atoi(exponent)
	k, n := len(digits), exp+1
	switch {
	case k <= n && n <= 21:
		return digits + strings.Repeat("0", n-k)
	case 0 < n && n <= 21:
		return digits[:n] + "." + digits[n:]
	case -6 < n && n <= 0:
		return "0." + strings.Repeat("0", -n) + digits
	}
	sign := "+"
	if n-1 < 0 {
		sign = "-"
	}
	power := strconv.Itoa(abs(n - 1))
	if k == 1 {
		return digits + "e" + sign + power
	}
	return digits[:1] + "." + digits[1:] + "e" + sign + power
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

// IsInteger is Number.isInteger.
func IsInteger(x float64) bool {
	return !math.IsInf(x, 0) && !math.IsNaN(x) && x == math.Trunc(x)
}

// Stringify is JSON.stringify for a string: quotes, backslashes and control
// characters escaped, everything else (U+2028, <, &…) written as is.
func Stringify(s string) string {
	var b strings.Builder
	b.Grow(len(s) + 2)
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				b.WriteString(`\u00`)
				b.WriteString(strconv.FormatInt(int64(r)>>4, 16))
				b.WriteString(strconv.FormatInt(int64(r)&15, 16))
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

// Line and paragraph separators: legal in JSON, not in a Dart string literal.
// Spelled as code points so no tool can turn the escapes into the characters.
const (
	lineSeparator      = rune(0x2028)
	paragraphSeparator = rune(0x2029)
)

// DartString is a Dart string literal for value: JSON.stringify, then `$`
// and the two Unicode separators escaped.
func DartString(value string) string {
	s := strings.ReplaceAll(Stringify(value), "$", `\$`)
	s = strings.ReplaceAll(s, string(lineSeparator), `\`+"u2028")
	return strings.ReplaceAll(s, string(paragraphSeparator), `\`+"u2029")
}

// StringifyList is JSON.stringify of a string array: `["a","b"]`.
func StringifyList(items []string) string {
	parts := make([]string, len(items))
	for i, item := range items {
		parts[i] = Stringify(item)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// Len is a JS string's .length: UTF-16 code units.
func Len(s string) int {
	n := 0
	for _, r := range s {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// Units is the string as UTF-16 code units, how JS indexes it.
func Units(s string) []uint16 { return utf16.Encode([]rune(s)) }

// FromUnits turns UTF-16 code units back into a Go string.
func FromUnits(u []uint16) string { return string(utf16.Decode(u)) }

// Slice is JS s.slice(from, to) on UTF-16 positions (clamped).
func Slice(s string, from, to int) string {
	u := Units(s)
	if to > len(u) {
		to = len(u)
	}
	if from < 0 {
		from = 0
	}
	if from >= to {
		return ""
	}
	return FromUnits(u[from:to])
}

// Bytes is TextEncoder's byte length (UTF-8), as the source size limit counts.
func Bytes(s string) int { return len(s) }

// IsSpace is JS /\s/ for one UTF-16 code unit.
func IsSpace(c uint16) bool {
	switch c {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff:
		return true
	}
	return c >= 0x2000 && c <= 0x200a
}

// IsSpaceRune is IsSpace for a rune (never true outside the BMP).
func IsSpaceRune(r rune) bool { return r < 0x10000 && IsSpace(uint16(r)) }

// Trim is String.prototype.trim.
func Trim(s string) string {
	return strings.TrimFunc(s, IsSpaceRune)
}

// IsWord is JS /\w/ (ASCII letters, digits and underscore).
func IsWord(c uint16) bool {
	return c == '_' || (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// ValidUTF8 reports whether s can be treated as a JS string unchanged.
func ValidUTF8(s string) bool { return utf8.ValidString(s) }
