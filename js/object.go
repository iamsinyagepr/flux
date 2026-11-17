package js

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
)

// Object is a JS object's own string keys and values, iterated in JS order:
// array-index keys ("0", "7") ascending first, then every other key in the
// order it was first added. A key set again keeps its original position —
// the same rules JSON.parse and Object.entries follow.
type Object[V any] struct {
	keys   []string
	values map[string]V
}

func NewObject[V any]() *Object[V] { return &Object[V]{values: map[string]V{}} }

// Set adds or replaces a key (a replaced key keeps its position).
func (o *Object[V]) Set(key string, value V) {
	if o.values == nil {
		o.values = map[string]V{}
	}
	if _, ok := o.values[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.values[key] = value
}

func (o *Object[V]) Get(key string) (V, bool) {
	var zero V
	if o == nil {
		return zero, false
	}
	value, ok := o.values[key]
	return value, ok
}

// Has is Object.hasOwn.
func (o *Object[V]) Has(key string) bool {
	_, ok := o.Get(key)
	return ok
}

func (o *Object[V]) Len() int {
	if o == nil {
		return 0
	}
	return len(o.keys)
}

// Keys is Object.keys: array-index keys first, ascending, then insertion order.
func (o *Object[V]) Keys() []string {
	if o == nil {
		return nil
	}
	var indexes, others []string
	for _, key := range o.keys {
		if arrayIndex(key) {
			indexes = append(indexes, key)
		} else {
			others = append(others, key)
		}
	}
	sort.SliceStable(indexes, func(i, j int) bool {
		a, _ := strconv.ParseUint(indexes[i], 10, 32)
		b, _ := strconv.ParseUint(indexes[j], 10, 32)
		return a < b
	})
	return append(indexes, others...)
}

// arrayIndex: a canonical uint32 below 2^32-1, which JS orders numerically.
func arrayIndex(key string) bool {
	if key == "" || (len(key) > 1 && key[0] == '0') {
		return false
	}
	n, err := strconv.ParseUint(key, 10, 32)
	return err == nil && n < math.MaxUint32
}

// UnmarshalJSON keeps the document's key order.
func (o *Object[V]) UnmarshalJSON(data []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if delim, ok := token.(json.Delim); !ok || delim != '{' {
		return fmt.Errorf("expected an object")
	}
	*o = Object[V]{values: map[string]V{}}
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		key := token.(string)
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			return err
		}
		var value V
		if err := json.Unmarshal(raw, &value); err != nil {
			return err
		}
		o.Set(key, value)
	}
	_, err = decoder.Token()
	return err
}

// MarshalJSON writes the keys in JS order.
func (o *Object[V]) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, key := range o.Keys() {
		if i > 0 {
			b.WriteByte(',')
		}
		k, _ := json.Marshal(key)
		b.Write(k)
		b.WriteByte(':')
		v, err := json.Marshal(o.values[key])
		if err != nil {
			return nil, err
		}
		b.Write(v)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// JSONKind is the type of a decoded JSON value.
type JSONKind uint8

const (
	JSONNull JSONKind = iota
	JSONBool
	JSONNumber
	JSONString
	JSONArray
	JSONObject
)

// JSON is any JSON value with objects in JS key order — for input whose
// shape is validated after decoding (a project's config), exactly as the
// TypeScript validator saw it.
type JSON struct {
	Kind   JSONKind
	Bool   bool
	Number float64
	String string
	Array  []*JSON
	Object *Object[*JSON]
}

func (j *JSON) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return fmt.Errorf("empty JSON value")
	}
	switch trimmed[0] {
	case '{':
		object := NewObject[*JSON]()
		if err := object.UnmarshalJSON(trimmed); err != nil {
			return err
		}
		*j = JSON{Kind: JSONObject, Object: object}
	case '[':
		var items []*JSON
		if err := json.Unmarshal(trimmed, &items); err != nil {
			return err
		}
		*j = JSON{Kind: JSONArray, Array: items}
	case '"':
		var s string
		if err := json.Unmarshal(trimmed, &s); err != nil {
			return err
		}
		*j = JSON{Kind: JSONString, String: s}
	case 't', 'f':
		var b bool
		if err := json.Unmarshal(trimmed, &b); err != nil {
			return err
		}
		*j = JSON{Kind: JSONBool, Bool: b}
	case 'n':
		*j = JSON{Kind: JSONNull}
	default:
		var n float64
		if err := json.Unmarshal(trimmed, &n); err != nil {
			return err
		}
		*j = JSON{Kind: JSONNumber, Number: n}
	}
	return nil
}

func (j *JSON) MarshalJSON() ([]byte, error) {
	if j == nil {
		return []byte("null"), nil
	}
	switch j.Kind {
	case JSONBool:
		return json.Marshal(j.Bool)
	case JSONNumber:
		return []byte(NumberString(j.Number)), nil
	case JSONString:
		return json.Marshal(j.String)
	case JSONArray:
		return json.Marshal(j.Array)
	case JSONObject:
		return j.Object.MarshalJSON()
	}
	return []byte("null"), nil
}

// IsObject: a non-null, non-array object.
func (j *JSON) IsObject() bool { return j != nil && j.Kind == JSONObject }

// Field is j[key] on an object (nil otherwise).
func (j *JSON) Field(key string) *JSON {
	if !j.IsObject() {
		return nil
	}
	value, _ := j.Object.Get(key)
	return value
}

// Value is the JS primitive for a JSON scalar (undefined for nil, arrays and objects).
func (j *JSON) Value() Value {
	if j == nil {
		return UndefinedValue()
	}
	switch j.Kind {
	case JSONNull:
		return NullValue()
	case JSONBool:
		return BoolValue(j.Bool)
	case JSONNumber:
		return NumberValue(j.Number)
	case JSONString:
		return StringValue(j.String)
	}
	return UndefinedValue()
}
