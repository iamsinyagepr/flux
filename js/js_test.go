package js

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNumberString(t *testing.T) {
	// Run-time float arithmetic; Go folds constant expressions exactly.
	a, b := 0.1, 0.2
	if got := NumberString(a + b); got != "0.30000000000000004" {
		t.Errorf("NumberString(0.1+0.2) = %q", got)
	}
	for in, want := range map[float64]string{
		0: "0", 1: "1", -1: "-1", 1.5: "1.5", 12.5: "12.5", 100: "100", 0.5: "0.5",
		1e21: "1e+21", 1e20: "100000000000000000000",
		1.5e21: "1.5e+21", 1e-7: "1e-7", 1.5e-7: "1.5e-7", 0.000001: "0.000001",
		123456789.125: "123456789.125", 9999: "9999", -0.25: "-0.25", 5e-324: "5e-324",
	} {
		if got := NumberString(in); got != want {
			t.Errorf("NumberString(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestStringify(t *testing.T) {
	for in, want := range map[string]string{
		`plain`:     `"plain"`,
		`a "q" \ b`: `"a \"q\" \\ b"`,
		"tab\tnl\n": `"tab\tnl\n"`,
		"\x01\x1f":  `"\u0001\u001f"`,
		"<&>   é":   "\"<&>   é\"",
		"😀":         "\"😀\"",
	} {
		if got := Stringify(in); got != want {
			t.Errorf("Stringify(%q) = %s, want %s", in, got, want)
		}
	}
	if got := StringifyList([]string{"a", "b"}); got != `["a","b"]` {
		t.Errorf("StringifyList = %s", got)
	}
}

func TestLengthsAndValues(t *testing.T) {
	if Len("a😀é") != 4 {
		t.Errorf("Len counts UTF-16 units, got %d", Len("a😀é"))
	}
	if Slice("a😀b", 1, 3) != "😀" {
		t.Error("Slice on UTF-16 positions")
	}
	if Trim("  x  ") != "x" {
		t.Error("Trim uses JS whitespace")
	}
	for _, falsy := range []Value{UndefinedValue(), NullValue(), BoolValue(false), NumberValue(0), StringValue("")} {
		if falsy.Truthy() {
			t.Errorf("%v should be falsy", falsy)
		}
	}
	if UndefinedValue().String() != "undefined" || NumberValue(2).String() != "2" {
		t.Error("String() follows JS String()")
	}
}

func TestObjectKeepsJSOrder(t *testing.T) {
	var object Object[int]
	if err := json.Unmarshal([]byte(`{"b":1,"a":2,"10":3,"2":4,"b":5}`), &object); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(object.Keys(), ","); got != "2,10,b,a" {
		t.Errorf("keys = %s", got)
	}
	if value, _ := object.Get("b"); value != 5 {
		t.Errorf("a repeated key takes the later value, got %d", value)
	}
	var value JSON
	if err := json.Unmarshal([]byte(`{"colors":{"z":"#000000","a":"#ffffff"},"n":1.5}`), &value); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(value.Field("colors").Object.Keys(), ","); got != "z,a" {
		t.Errorf("nested keys = %s", got)
	}
	out, _ := json.Marshal(&value)
	if string(out) != `{"colors":{"z":"#000000","a":"#ffffff"},"n":1.5}` {
		t.Errorf("round trip = %s", out)
	}
}
