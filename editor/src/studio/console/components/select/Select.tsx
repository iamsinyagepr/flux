// Synced from Upskale Studio (upskaleapp/src/console/components/select/Select.tsx). Edit it there, then npm run sync.
import { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import StudioSelect from '../../../components/studio/StudioSelect';
import type { Props } from "../../../components/Select";
import { optionsOf } from "../../functions/select/index";

/**
 * The app's dropdown in place of a `<select>`: the same props and the same
 * `<option>` / `<optgroup>` children, so swapping one in is a rename. Drawn by
 * StudioSelect; a hidden native select is kept in step underneath, so form
 * validation (`required`, `onInvalid`), `name` and a ref still work, and
 * `onChange` gets an event whose target is that select with its new value.
 */
export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  {
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    onInvalid,
    children,
    className = '',
    disabled,
    required,
    name,
    id,
    title,
    form,
    look = 'console',
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
  },
  ref,
) {
  const native = useRef<HTMLSelectElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => native.current!);
  const options = optionsOf(children);
  const [own, setOwn] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
  const controlled = value !== undefined;
  const current = controlled ? String(value) : own;
  // The native select's events, as a select's handlers expect them.
  const as = <E,>() => ({ target: native.current, currentTarget: native.current }) as unknown as E;

  return (
    <>
      <StudioSelect
        look={look}
        label={ariaLabel ?? title ?? name ?? 'Choose'}
        value={current}
        options={options}
        disabled={disabled}
        className={className || (look === 'console' ? 'rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[13px]' : '')}
        id={id}
        // With an id and no name of its own, a <label htmlFor> names it.
        labelledByElement={Boolean(id) && !ariaLabel}
        title={title}
        buttonRef={button}
        invalid={ariaInvalid === true || ariaInvalid === 'true'}
        describedBy={describedBy}
        onFocus={onFocus && (() => onFocus(as()))}
        onBlur={onBlur && (() => onBlur(as()))}
        onChange={(next) => {
          if (native.current) native.current.value = next;
          if (!controlled) setOwn(next);
          onChange?.(as());
        }}
      />
      <select
        ref={native}
        aria-hidden="true"
        tabIndex={-1}
        value={current}
        onChange={() => undefined}
        required={required}
        disabled={disabled}
        name={name}
        form={form}
        onInvalid={onInvalid}
        // Validation focuses the field to fix: that's the button.
        onFocus={() => button.current?.focus()}
        // Inline, so no stylesheet's `select` rule can show it.
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          border: 0,
          opacity: 0,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          pointerEvents: 'none',
        }}
      >
        {children}
      </select>
    </>
  );
});
