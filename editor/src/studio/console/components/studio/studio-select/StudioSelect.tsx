// Synced from Upskale Studio (upskaleapp/src/console/components/studio/studio-select/StudioSelect.tsx). Edit it there, then npm run sync.
import { portalRoot } from "../../../../../host/portal";
import { type Ref, type FocusEvent, useId, useRef, useState, useLayoutEffect, useEffect, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MdExpandMore, MdSearch, MdCheck } from "react-icons/md";
import type { SelectOption } from "../../../../components/studio/StudioSelect";
import { LOOKS } from "../../../constants/studio/studio-select/index";
import { DropdownScrim } from "../../dropdown-sheet/DropdownScrim";

/**
 * The app's dropdown (a native select can't be styled): a button showing the
 * choice, and a list below it. Long lists get a search box. Arrow keys,
 * Home/End, Enter and Escape work as in a native select; the list is
 * portalled so a scrolling panel, a dialog or a zoomed canvas doesn't clip it.
 * `look` picks Studio's styling or the console's. For a drop-in replacement of
 * a `<select>` with `<option>` children, see `components/Select.tsx`.
 */
export function StudioSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  look = "studio",
  id: buttonId,
  title,
  buttonRef,
  onFocus,
  onBlur,
  invalid,
  describedBy,
  labelledByElement = false,
}: {
  /** The accessible name. */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  look?: keyof typeof LOOKS;
  /** The button's id, for a `<label htmlFor>`. */
  id?: string;
  title?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: FocusEvent<HTMLButtonElement>) => void;
  invalid?: boolean;
  describedBy?: string;
  /** A `<label htmlFor={id}>` names the button: no aria-label over it (an
   *  aria-label would win, and every labelled field would read "Choose"). */
  labelledByElement?: boolean;
}) {
  const id = useId();
  const css = LOOKS[look];
  const button = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 200 });
  const searchable = options.length > 10;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) => (option.label + " " + (option.group ?? "") + " " + option.value).toLowerCase().includes(needle))
    : options;
  const current = options.find((option) => option.value === value);

  const show = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = button.current!.getBoundingClientRect();
      const height = list.current?.offsetHeight ?? 240;
      const below = box.bottom + 4 + height <= window.innerHeight;
      setPosition({
        left: Math.max(8, Math.min(box.left, window.innerWidth - Math.max(box.width, 200) - 8)),
        top: below ? box.bottom + 4 : Math.max(8, box.top - height - 4),
        width: Math.max(box.width, 200),
      });
    };
    place();
    // Follow the button when the page (or a panel) scrolls under it.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, shown.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const keyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
        // A dialog behind it closes on Escape too: this one is first.
        event.stopPropagation();
      }
      close(event.key === "Escape");
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : shown.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(shown[active]);
    }
  };

  let lastGroup: string | undefined;
  return (
    <>
      <button
        ref={(element) => {
          button.current = element;
          if (typeof buttonRef === "function") buttonRef(element);
          else if (buttonRef) (buttonRef as { current: HTMLButtonElement | null }).current = element;
        }}
        id={buttonId}
        title={title}
        type="button"
        className={css.button + " " + className}
        role="combobox"
        aria-label={labelledByElement ? undefined : label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={keyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className={css.value}>{current?.label ?? value}</span>
        <MdExpandMore aria-hidden="true" className={look === "console" ? "size-4 shrink-0 text-steel" : undefined} />
      </button>
      {open &&
        createPortal(
          <>
          <DropdownScrim onClose={() => close()} />
          <div
            ref={list}
            className={`${css.list} dropdown-sheet`}
            style={{ left: position.left, top: position.top, minWidth: position.width }}
            onKeyDown={keyDown}
            // A portal still bubbles through React: keep the canvas from panning on a pick.
            onPointerDown={(event) => event.stopPropagation()}
          >
            {searchable && (
              <label className={css.search}>
                <MdSearch aria-hidden="true" />
                <input
                  autoFocus
                  aria-label={"Search " + label.toLowerCase()}
                  placeholder="Search…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                />
              </label>
            )}
            <div
              id={id}
              role="listbox"
              aria-label={label}
              aria-activedescendant={shown[active] ? id + "-" + active : undefined}
              tabIndex={searchable ? undefined : -1}
              ref={(element) => {
                if (!searchable && element && document.activeElement !== element) element.focus();
              }}
            >
              {shown.length === 0 && <p className={css.empty}>Nothing matches</p>}
              {shown.map((option, index) => {
                const heading = option.group !== lastGroup ? option.group : undefined;
                lastGroup = option.group;
                const selected = option.value === value;
                return (
                  <div key={option.group + "\u0000" + option.value} role="presentation">
                    {heading && (
                      <div className={css.section} role="presentation">
                        {heading}
                      </div>
                    )}
                    <div
                      id={id + "-" + index}
                      role="option"
                      data-index={index}
                      aria-selected={selected}
                      aria-disabled={option.disabled || undefined}
                      className={css.option + (index === active ? css.active : "")}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                    >
                      <span className={look === "console" ? "min-w-0 truncate" : undefined}>{option.label}</span>
                      {option.hint && <small>{option.hint}</small>}
                      {look === "console" && (
                        <MdCheck aria-hidden="true" className={`size-4 shrink-0 text-accent ${selected ? "" : "invisible"} ${option.hint ? "" : "ml-auto"}`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>,
          // Inside a modal <dialog> (the top layer), the list must be too:
          // portaled to the body it would open underneath, unseen.
          button.current?.closest("dialog") ?? portalRoot(),
        )}
    </>
  );
}

export default StudioSelect;
